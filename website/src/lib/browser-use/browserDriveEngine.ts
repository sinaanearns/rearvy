/**
 * Browser Drive Engine
 *
 * The core AI reasoning loop that continuously:
 *  1. Scans the live Firecrawl browser page for current state
 *  2. Asks the AI to generate the next Playwright code step
 *  3. Executes that code in the live browser session
 *  4. Updates the persisted session logs
 *  5. Repeats until done, max steps exceeded, or approval needed
 *
 * This makes Rearvy actively code and drive the browser — not just
 * fire a single pre-built script and walk away.
 */

import { createServerLogger } from "@/lib/server-logger";
import { firecrawlExecuteInSession } from "@/lib/firecrawl/client";
import { readSession, writeSession, type PersistedSession } from "@/lib/browser-use/session-store";
import {
  generateBrowserStep,
  type PageState,
  type PriorStep,
  type GeneratedStep,
} from "./aiStepGenerator";

const log = createServerLogger("BrowserDriveEngine");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DriveStepUpdate = {
  type: "step_start" | "step_done" | "approval_required" | "done" | "error" | "progress";
  step?: number;
  maxSteps?: number;
  action?: string;
  reasoning?: string;
  code?: string;
  result?: string;
  error?: string;
  requiresApproval?: boolean;
  approvalId?: string;
  approvalReason?: string;
  isDone?: boolean;
  summary?: string;
  url?: string;
  title?: string;
  confidence?: number;
};

export type DriveSessionOptions = {
  maxSteps?: number;
  stepTimeoutSeconds?: number;
  isDesktopApp?: boolean;
  /** Set to false to force user approval prompts for sensitive steps. Defaults to true (Full Access mode). */
  autoApprove?: boolean;
  /** Called after every step/event — use to stream updates to the client */
  onUpdate?: (update: DriveStepUpdate) => void | Promise<void>;
};

export type DriveSessionResult = {
  ok: boolean;
  summary: string;
  stepsCompleted: number;
  finalUrl: string | null;
  finalTitle: string | null;
  needsApproval: boolean;
  approvalId?: string;
  approvalReason?: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Page scanning — reads live browser state via Playwright
// ---------------------------------------------------------------------------

const PAGE_SCAN_CODE = [
  "import json",
  "",
  "try:",
  "    title = await page.title()",
  "    url = page.url",
  "",
  "    # Get visible text content (truncated)",
  '    content_raw = await page.evaluate("""',
  "        () => {",
  "            const body = document.body;",
  "            if (!body) return '';",
  "            // Remove script/style content",
  "            const clone = body.cloneNode(true);",
  "            clone.querySelectorAll('script,style,noscript,svg').forEach(el => el.remove());",
  "            return clone.innerText || clone.textContent || '';",
  "        }",
  '    """)',
  "    content = str(content_raw)[:3000] if content_raw else ''",
  "",
  "    # Get visible interactive elements",
  '    elements_raw = await page.evaluate("""',
  "        () => {",
  "            const items = [];",
  "            // Inputs",
  "            document.querySelectorAll('input:not([type=hidden]),textarea,select').forEach(el => {",
  "                const label = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name') || el.id || el.type || 'input';",
  "                const t = el.getAttribute('type') || el.tagName.toLowerCase();",
  '                items.push("INPUT[" + t + "]: " + label);',
  "            });",
  "            // Buttons",
  "            document.querySelectorAll('button,[role=button]').forEach(el => {",
  "                const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 80);",
  '                if (text) items.push("BUTTON: " + text);',
  "            });",
  "            // Links",
  "            document.querySelectorAll('a[href]').forEach(el => {",
  "                const text = (el.innerText || el.textContent || '').trim().slice(0, 60);",
  '                if (text && !text.includes("\\n")) items.push("LINK: " + text);',
  "            });",
  '            return items.slice(0, 50).join("\\n");',
  "        }",
  '    """)',
  "    elements = str(elements_raw)[:2000] if elements_raw else ''",
  "",
  "    result = json.dumps({",
  '        "url": url,',
  '        "title": title,',
  '        "content": content,',
  '        "elements": elements,',
  "    })",
  "    print(result)",
  "except Exception as e:",
  "    import json",
  '    print(json.dumps({"url": "unknown", "title": "error", "content": "Scan error", "elements": ""}))',
].join("\n");

async function scanPageState(sessionId: string, timeoutSeconds = 20): Promise<PageState> {
  const result = await firecrawlExecuteInSession(sessionId, PAGE_SCAN_CODE, {
    language: "python",
    timeout: timeoutSeconds,
  });

  const output = result.stdout || result.result || "";

  // Try to parse JSON output from the scan
  try {
    const lines = output.split("\n").filter(Boolean);
    for (const line of lines.reverse()) {
      const trimmed = line.trim();
      if (trimmed.startsWith("{")) {
        const parsed = JSON.parse(trimmed) as Partial<PageState>;
        return {
          url: parsed.url || "unknown",
          title: parsed.title || "unknown",
          content: parsed.content || "",
          elements: parsed.elements || "",
        };
      }
    }
  } catch {
    // fall through to defaults
  }

  // Fallback if parsing fails
  return {
    url: "unknown",
    title: "unknown",
    content: output.slice(0, 3000),
    elements: "",
  };
}

// ---------------------------------------------------------------------------
// Session persistence helpers
// ---------------------------------------------------------------------------

function pushSessionAction(
  sessionId: string,
  action: string,
  status: string,
  message: string,
  extra?: Partial<Pick<PersistedSession, "currentUrl" | "title">>
) {
  const existing = readSession(sessionId);
  if (!existing) return;

  const now = new Date().toISOString();
  const updated: PersistedSession = {
    ...existing,
    ...(extra?.currentUrl !== undefined ? { currentUrl: extra.currentUrl } : {}),
    ...(extra?.title !== undefined ? { title: extra.title } : {}),
    stdout: [...(existing.stdout || []), `[${status}] ${message}`].slice(-500),
    actionLog: [
      ...(existing.actionLog || []),
      {
        id: `drive_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        action,
        status,
        message,
        timestamp: now,
      },
    ].slice(-120),
  };

  writeSession(updated);
}

function setSessionAwaitingApproval(
  sessionId: string,
  approvalId: string,
  reason: string,
  command: string | null
) {
  const existing = readSession(sessionId);
  if (!existing) return;

  const updated: PersistedSession = {
    ...existing,
    status: "awaiting_approval",
    awaitingApproval: { id: approvalId, reason, command },
  };

  writeSession(updated);
}

function setSessionComplete(sessionId: string, summary: string, url: string | null, title: string | null) {
  const existing = readSession(sessionId);
  if (!existing) return;

  const updated: PersistedSession = {
    ...existing,
    status: "completed",
    isRunning: false,
    summary,
    ...(url ? { currentUrl: url } : {}),
    ...(title ? { title } : {}),
    exitedAt: Date.now(),
    exitCode: 0,
  };

  writeSession(updated);
}

function setSessionFailed(sessionId: string, error: string) {
  const existing = readSession(sessionId);
  if (!existing) return;

  const updated: PersistedSession = {
    ...existing,
    status: "failed",
    isRunning: false,
    summary: `Drive failed: ${error}`,
    exitedAt: Date.now(),
    exitCode: 1,
  };

  writeSession(updated);
}

function extractEmails(value: string): string[] {
  const matches = value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  return [...new Set(matches.map((email) => email.toLowerCase()))];
}

function extractEmailsFromCode(code: string): string[] {
  const found = new Set<string>();
  const fillOrTypeRegex = /(?:fill|type)\(\s*["']([^"'\s]+@[^"'\s]+\.[A-Za-z]{2,})["']/g;
  let match: RegExpExecArray | null;
  while ((match = fillOrTypeRegex.exec(code)) !== null) {
    found.add(match[1].toLowerCase());
  }
  return [...found];
}

function containsBlockedAutofillEmail(goal: string, code: string): { blocked: boolean; reason: string } {
  const allowed = new Set(extractEmails(goal));
  const usedInCode = extractEmailsFromCode(code);
  if (!usedInCode.length) {
    return { blocked: false, reason: "" };
  }

  for (const email of usedInCode) {
    const looksSynthetic =
      /@(example|test|fake|demo|temp|invalid)\./i.test(email) ||
      /\b(test|fake|demo|temp|random)\b/i.test(email);

    if (!allowed.has(email) || looksSynthetic) {
      return {
        blocked: true,
        reason: `Blocked autogenerated or unapproved email entry: ${email}. Ask user to pick an account or provide the exact email.`,
      };
    }
  }

  return { blocked: false, reason: "" };
}

function extractAuthEmailNote(code: string): string | null {
  const emails = extractEmailsFromCode(code);
  if (!emails.length) {
    return null;
  }
  return `Email in step: ${emails.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Core drive loop
// ---------------------------------------------------------------------------

export async function driveBrowserSession(
  sessionId: string,
  goal: string,
  userId: string,
  options: DriveSessionOptions = {}
): Promise<DriveSessionResult> {
  const {
    maxSteps = 15,
    stepTimeoutSeconds = 60,
    isDesktopApp = false,
    onUpdate,
  } = options;

  log.info(`[BrowserDriveEngine] Starting drive loop for session ${sessionId}`, {
    goal: goal.slice(0, 80),
    maxSteps,
  });

  const emit = async (update: DriveStepUpdate) => {
    try {
      await onUpdate?.(update);
    } catch (e) {
      log.warn("[BrowserDriveEngine] onUpdate callback error:", e);
    }
  };

  const priorSteps: PriorStep[] = [];
  let finalUrl: string | null = null;
  let finalTitle: string | null = null;

  pushSessionAction(
    sessionId,
    "drive_start",
    "running",
    `Starting AI drive loop for goal: ${goal.slice(0, 220)}`
  );

  for (let stepNum = 1; stepNum <= maxSteps; stepNum++) {
    log.info(`[BrowserDriveEngine] Step ${stepNum}/${maxSteps} — scanning page...`);

    // 1. Scan live page state
    let pageState: PageState;
    try {
      pageState = await scanPageState(sessionId, 20);
      finalUrl = pageState.url !== "unknown" ? pageState.url : finalUrl;
      finalTitle = pageState.title !== "unknown" ? pageState.title : finalTitle;

      pushSessionAction(sessionId, "scan_page", "running", `Scanning page: ${pageState.title} (${pageState.url})`, {
        currentUrl: pageState.url !== "unknown" ? pageState.url : undefined,
        title: pageState.title !== "unknown" ? pageState.title : undefined,
      });

      await emit({
        type: "progress",
        step: stepNum,
        maxSteps,
        action: "scan_page",
        url: pageState.url,
        title: pageState.title,
      });
    } catch (scanError) {
      const errMsg = scanError instanceof Error ? scanError.message : String(scanError);
      log.error(`[BrowserDriveEngine] Page scan failed at step ${stepNum}:`, scanError);
      pushSessionAction(sessionId, "scan_page", "failed", `Scan error: ${errMsg}`);
      await emit({ type: "error", step: stepNum, error: `Page scan failed: ${errMsg}` });

      setSessionFailed(sessionId, `Page scan failed at step ${stepNum}: ${errMsg}`);
      return {
        ok: false,
        summary: `Page scan failed at step ${stepNum}: ${errMsg}`,
        stepsCompleted: stepNum - 1,
        finalUrl,
        finalTitle,
        needsApproval: false,
        error: errMsg,
      };
    }

    // 2. Ask AI for next step
    let generatedStep: GeneratedStep | null;
    try {
      generatedStep = await generateBrowserStep({
        goal,
        pageState,
        priorSteps,
        isDesktopApp,
      });
    } catch (aiError) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError);
      log.error(`[BrowserDriveEngine] AI step generation failed at step ${stepNum}:`, aiError);
      pushSessionAction(sessionId, "ai_step_gen", "failed", `AI step generation error: ${errMsg}`);
      await emit({ type: "error", step: stepNum, error: `AI reasoning failed: ${errMsg}` });

      setSessionFailed(sessionId, `AI step generation failed: ${errMsg}`);
      return {
        ok: false,
        summary: `AI step generation failed: ${errMsg}`,
        stepsCompleted: stepNum - 1,
        finalUrl,
        finalTitle,
        needsApproval: false,
        error: errMsg,
      };
    }

    if (!generatedStep) {
      const errMsg = "AI returned no step — model may not be configured.";
      pushSessionAction(sessionId, "ai_step_gen", "failed", errMsg);
      await emit({ type: "error", step: stepNum, error: errMsg });
      setSessionFailed(sessionId, errMsg);
      return {
        ok: false,
        summary: errMsg,
        stepsCompleted: stepNum - 1,
        finalUrl,
        finalTitle,
        needsApproval: false,
        error: errMsg,
      };
    }

    // 3. Check if goal is already done
    if (generatedStep.isDone) {
      const summary = generatedStep.summary || `Goal achieved: ${goal}`;
      log.info(`[BrowserDriveEngine] Goal achieved at step ${stepNum}: ${summary}`);

      pushSessionAction(sessionId, "goal_achieved", "completed", summary, {
        currentUrl: finalUrl || undefined,
        title: finalTitle || undefined,
      });

      setSessionComplete(sessionId, summary, finalUrl, finalTitle);

      await emit({
        type: "done",
        step: stepNum,
        summary,
        url: finalUrl || undefined,
        title: finalTitle || undefined,
      });

      return {
        ok: true,
        summary,
        stepsCompleted: stepNum,
        finalUrl,
        finalTitle,
        needsApproval: false,
      };
    }

    // 4. Emit step start
    await emit({
      type: "step_start",
      step: stepNum,
      maxSteps,
      action: generatedStep.action,
      reasoning: generatedStep.reasoning,
      code: generatedStep.playwrightCode,
      requiresApproval: generatedStep.requiresApproval,
      confidence: generatedStep.confidence,
    });

    const authEmailNote = extractAuthEmailNote(generatedStep.playwrightCode);

    pushSessionAction(
      sessionId,
      generatedStep.action,
      "running",
      `Step ${stepNum} planned: ${generatedStep.reasoning}${authEmailNote ? ` | ${authEmailNote}` : ""}`,
    );

    // 5. Check if approval required before executing (bypassed when autoApprove is active / Full Access System)
    const autoApprove = options.autoApprove !== false;
    if (generatedStep.requiresApproval && !autoApprove) {
      const approvalId = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const approvalReason = `Rearvy is about to execute: "${generatedStep.action}". Reason: ${generatedStep.reasoning}`;

      log.info(`[BrowserDriveEngine] Approval required at step ${stepNum}: ${generatedStep.action}`);

      setSessionAwaitingApproval(sessionId, approvalId, approvalReason, generatedStep.playwrightCode);

      await emit({
        type: "approval_required",
        step: stepNum,
        action: generatedStep.action,
        reasoning: generatedStep.reasoning,
        code: generatedStep.playwrightCode,
        requiresApproval: true,
        approvalId,
        approvalReason,
      });

      return {
        ok: true,
        summary: `Paused at step ${stepNum} — awaiting approval for: ${generatedStep.action}`,
        stepsCompleted: stepNum - 1,
        finalUrl,
        finalTitle,
        needsApproval: true,
        approvalId,
        approvalReason,
      };
    } else if (generatedStep.requiresApproval) {
      log.info(`[BrowserDriveEngine] Auto-approving step ${stepNum} ("${generatedStep.action}") in Full Access mode.`);
    }

    const emailGuard = containsBlockedAutofillEmail(goal, generatedStep.playwrightCode);
    if (emailGuard.blocked) {
      pushSessionAction(sessionId, generatedStep.action, "failed", `Step ${stepNum} blocked: ${emailGuard.reason}`);
      priorSteps.push({
        step: stepNum,
        action: generatedStep.action,
        code: generatedStep.playwrightCode,
        result: emailGuard.reason,
        status: "error",
      });

      await emit({
        type: "step_done",
        step: stepNum,
        maxSteps,
        action: generatedStep.action,
        result: emailGuard.reason,
        isDone: false,
        url: finalUrl || undefined,
        title: finalTitle || undefined,
      });

      continue;
    }

    pushSessionAction(
      sessionId,
      generatedStep.action,
      "running",
      `Executing step ${stepNum}: ${generatedStep.action}`
    );

    // 6. Execute the AI-generated Playwright code
    let execResult: string;
    let execStatus: "success" | "error";

    try {
      log.info(`[BrowserDriveEngine] Executing step ${stepNum}: ${generatedStep.action}`);

      const result = await firecrawlExecuteInSession(
        sessionId,
        generatedStep.playwrightCode,
        { language: "python", timeout: stepTimeoutSeconds }
      );

      execResult = result.stdout || result.result || "(no output)";
      if (result.stderr) execResult += `\n[stderr]: ${result.stderr}`;

      execStatus = result.success && !result.killed ? "success" : "error";

      if (!result.success) {
        execResult = `[FAILED] ${result.error || result.stderr || "Execution failed"}\n${execResult}`;
      }
    } catch (execError) {
      execResult = execError instanceof Error ? execError.message : String(execError);
      execStatus = "error";
    }

    // 7. Record step in history
    priorSteps.push({
      step: stepNum,
      action: generatedStep.action,
      code: generatedStep.playwrightCode,
      result: execResult.slice(0, 1000),
      status: execStatus,
    });

    pushSessionAction(
      sessionId,
      generatedStep.action,
      execStatus === "success" ? "completed" : "failed",
      `Step ${stepNum} result: ${execResult.slice(0, 500)}`
    );

    await emit({
      type: "step_done",
      step: stepNum,
      maxSteps,
      action: generatedStep.action,
      result: execResult.slice(0, 2000),
      isDone: false,
      url: finalUrl || undefined,
      title: finalTitle || undefined,
    });

    // 8. Short pause between steps to let page settle
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  // Max steps exceeded
  const summary = `Reached maximum steps (${maxSteps}). Progress made: ${priorSteps
    .filter((s) => s.status === "success")
    .map((s) => s.action)
    .join(", ") || "none"}.`;

  log.warn(`[BrowserDriveEngine] Max steps (${maxSteps}) reached for session ${sessionId}`);

  pushSessionAction(sessionId, "max_steps_reached", "failed", summary);
  setSessionFailed(sessionId, summary);

  await emit({ type: "error", error: summary });

  return {
    ok: false,
    summary,
    stepsCompleted: maxSteps,
    finalUrl,
    finalTitle,
    needsApproval: false,
    error: "Max steps exceeded",
  };
}

// ---------------------------------------------------------------------------
// Resume after approval
// ---------------------------------------------------------------------------

export async function resumeAfterApproval(
  sessionId: string,
  approvalId: string,
  goal: string,
  userId: string,
  options: DriveSessionOptions = {}
): Promise<DriveSessionResult> {
  const existing = readSession(sessionId);
  if (!existing) {
    return { ok: false, summary: "Session not found", stepsCompleted: 0, finalUrl: null, finalTitle: null, needsApproval: false, error: "Session not found" };
  }

  // Clear awaiting approval state
  const updated: PersistedSession = {
    ...existing,
    status: "running",
    awaitingApproval: null,
  };
  writeSession(updated);

  // Execute the approved code (stored in awaitingApproval.command)
  const approvedCode = existing.awaitingApproval?.command;
  if (approvedCode) {
    try {
      await firecrawlExecuteInSession(sessionId, approvedCode, {
        language: "python",
        timeout: options.stepTimeoutSeconds ?? 60,
      });
      pushSessionAction(sessionId, "approved_action", "completed", `Approved action executed for ${approvalId}`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      pushSessionAction(sessionId, "approved_action", "failed", `Approved action failed: ${errMsg}`);
    }
  }

  // Continue the drive loop
  return driveBrowserSession(sessionId, goal, userId, options);
}
