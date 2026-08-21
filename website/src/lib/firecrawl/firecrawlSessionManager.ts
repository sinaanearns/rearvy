/**
 * Firecrawl Session Manager Adapter
 * Bridges Firecrawl cloud browser (scraping + live interact sessions) into
 * Rearvy's unified browser session lifecycle and storage models.
 *
 * Two session modes:
 *  1. Scrape-mode   — fast snapshot of a page (no persistent browser)
 *  2. Interact-mode — live Firecrawl cloud browser with liveViewUrl the user can see
 */

import { randomUUID } from "crypto";
import {
  firecrawlScrapeUrl,
  firecrawlMapUrl,
  firecrawlCreateInteractSession,
  firecrawlExecuteInSession,
  firecrawlDeleteInteractSession,
  isFirecrawlConfigured,
  type FirecrawlScrapeResponse,
} from "./client";
import { writeSession, readSession, type PersistedSession } from "@/lib/browser-use/session-store";

export type FirecrawlSessionResult = {
  ok: boolean;
  id: string;
  status: string;
  summary: string | null;
  currentUrl: string | null;
  title: string | null;
  connectionMethod: "firecrawl";
  reused?: boolean;
  error?: string;
  screenshotDataUrl?: string | null;
  markdown?: string | null;
  /** Read-only live view URL for the Firecrawl cloud browser */
  liveViewUrl?: string | null;
  /** Interactive live view URL — user can control the browser directly */
  interactiveLiveViewUrl?: string | null;
};

const URL_REGEX = /https?:\/\/[^\s]+/i;

type AuthIntent = "login" | "signup" | null;

function extractUrlFromTask(task: string): string | null {
  const match = task.match(URL_REGEX);
  if (match) {
    return match[0].replace(/[).,;"]+$/, "");
  }
  return null;
}

function buildSearchOrTargetUrl(task: string): string {
  const extractedUrl = extractUrlFromTask(task);
  if (extractedUrl) {
    return extractedUrl;
  }

  // If task looks like a search request, construct a search URL or fallback
  const cleanTask = task.trim();
  if (cleanTask.length > 0) {
    return `https://www.google.com/search?q=${encodeURIComponent(cleanTask)}`;
  }

  return "https://www.google.com";
}

function detectAuthIntent(task: string): AuthIntent {
  const lowerTask = task.toLowerCase();
  const hasSignupIntent =
    /\b(sign\s*up|signup|register|create\s+(?:an?\s+)?account|get\s*started|new\s+account)\b/i.test(
      lowerTask
    );
  const hasLoginIntent =
    /\b(sign\s*in|signin|log\s*in|login|authenticate|access\s+account)\b/i.test(lowerTask);

  if (hasSignupIntent && !hasLoginIntent) return "signup";
  if (hasLoginIntent && !hasSignupIntent) return "login";
  return null;
}

function inferFirecrawlStartUrl(task: string): { url: string; authIntent: AuthIntent } {
  const explicitUrl = extractUrlFromTask(task);
  if (explicitUrl) {
    return { url: explicitUrl, authIntent: detectAuthIntent(task) };
  }

  const authIntent = detectAuthIntent(task);

  if (/\b(shopify)\b/i.test(task)) {
    if (authIntent === "signup") {
      return { url: "https://www.shopify.com/signup", authIntent };
    }

    if (authIntent === "login") {
      return { url: "https://accounts.shopify.com/store-login", authIntent };
    }

    return { url: "https://accounts.shopify.com", authIntent };
  }

  if (/\b(chatgpt|gpt|dall-e|image|picture|draw|paint|genrate)\b/i.test(task)) {
    return { url: "https://chatgpt.com", authIntent };
  }

  return { url: "https://www.google.com", authIntent };
}

export async function createFirecrawlSession(
  task: string,
  userId: string,
  options: {
    dedupeKey?: string | null;
    strategy?: "goal-seeking" | "open-only";
  } = {}
): Promise<FirecrawlSessionResult> {
  const sessionId = `fc_${randomUUID()}`;
  const targetUrl = buildSearchOrTargetUrl(task);
  const nowIso = new Date().toISOString();

  if (!isFirecrawlConfigured()) {
    return {
      ok: false,
      id: sessionId,
      status: "failed",
      summary: null,
      currentUrl: targetUrl,
      title: null,
      connectionMethod: "firecrawl",
      error:
        "Firecrawl is not configured. Set FIRECRAWL_API_KEY or FIRECRAWL_API_URL in your environment.",
    };
  }

  try {
    const isMapRequest = /\b(sitemap|map|find links|discover pages)\b/i.test(task);
    let scrapeResult: FirecrawlScrapeResponse;
    let summary: string;

    if (isMapRequest) {
      const mapRes = await firecrawlMapUrl(targetUrl);
      if (mapRes.success && mapRes.links && mapRes.links.length > 0) {
        summary = `Firecrawl mapped ${mapRes.links.length} links for ${targetUrl}:\n- ${mapRes.links.slice(0, 10).join("\n- ")}`;
        scrapeResult = {
          success: true,
          data: {
            markdown: summary,
            metadata: {
              title: `Firecrawl Map: ${targetUrl}`,
              sourceURL: targetUrl,
            },
          },
        };
      } else {
        scrapeResult = await firecrawlScrapeUrl(targetUrl, {
          formats: ["markdown", "html", "screenshot"],
        });
        summary = scrapeResult.data?.markdown
          ? scrapeResult.data.markdown.slice(0, 500)
          : `Scraped ${targetUrl} via Firecrawl.`;
      }
    } else {
      scrapeResult = await firecrawlScrapeUrl(targetUrl, {
        formats: ["markdown", "html", "screenshot"],
      });
      summary = scrapeResult.data?.markdown
        ? scrapeResult.data.markdown.slice(0, 800)
        : `Scraped ${targetUrl} via Firecrawl.`;
    }

    if (!scrapeResult.success) {
      return {
        ok: false,
        id: sessionId,
        status: "failed",
        summary: null,
        currentUrl: targetUrl,
        title: null,
        connectionMethod: "firecrawl",
        error: scrapeResult.error || "Firecrawl failed to scrape target URL.",
      };
    }

    const pageData = scrapeResult.data;
    const title = pageData?.metadata?.title || targetUrl;
    const currentUrl = pageData?.metadata?.sourceURL || targetUrl;
    const screenshotDataUrl = pageData?.screenshot || null;
    const markdown = pageData?.markdown || null;

    const persistedSession: PersistedSession = {
      id: sessionId,
      task,
      createdAt: Date.now(),
      userId,
      dedupeKey: options.dedupeKey || null,
      strategy: options.strategy || "goal-seeking",
      connectionMethod: "firecrawl",
      connectionStatus: "connected",
      stdout: [`Firecrawl scrape completed for ${currentUrl}`],
      stderr: [],
      isRunning: false,
      status: "completed",
      currentUrl,
      title,
      summary,
      screenshotDataUrl,
      actionLog: [
        {
          id: `fc_action_${Date.now()}`,
          action: "firecrawl_scrape",
          status: "completed",
          message: `Firecrawl live scrape of ${currentUrl}`,
          timestamp: nowIso,
        },
      ],
    };

    writeSession(persistedSession);

    return {
      ok: true,
      id: sessionId,
      status: "completed",
      summary,
      currentUrl,
      title,
      connectionMethod: "firecrawl",
      screenshotDataUrl,
      markdown,
    };
  } catch (error) {
    return {
      ok: false,
      id: sessionId,
      status: "failed",
      summary: null,
      currentUrl: targetUrl,
      title: null,
      connectionMethod: "firecrawl",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ---------------------------------------------------------------------------
// Interact — Full cloud browser session (live view, code execution, cleanup)
// ---------------------------------------------------------------------------

export type FirecrawlInteractSessionResult = {
  ok: boolean;
  id: string;
  status: string;
  liveViewUrl: string | null;
  interactiveLiveViewUrl: string | null;
  connectionMethod: "firecrawl";
  error?: string;
  expiresAt?: string;
};

/**
 * Create a full Firecrawl cloud-hosted browser session.
 * Creates the browser, navigates to the target URL (e.g. chatgpt.com or target site),
 * persists state to session-store, and returns liveViewUrl for embedding.
 */
export async function createFirecrawlInteractSession(
  task: string,
  userId: string,
  options: {
    dedupeKey?: string | null;
    ttl?: number;
    profileName?: string;
  } = {}
): Promise<FirecrawlInteractSessionResult> {
  if (!isFirecrawlConfigured()) {
    return {
      ok: false,
      id: "",
      status: "failed",
      liveViewUrl: null,
      interactiveLiveViewUrl: null,
      connectionMethod: "firecrawl",
      error: "Firecrawl is not configured. Set FIRECRAWL_API_KEY in your environment.",
    };
  }

  const session = await firecrawlCreateInteractSession({
    ttl: options.ttl ?? 600,
    activityTtl: 300,
    ...(options.profileName ? { profileName: options.profileName } : {}),
  });

  const formattedSessionId = session.id.startsWith("fc_") ? session.id : `fc_${session.id}`;

  if (!session.success || !session.id) {
    return {
      ok: false,
      id: formattedSessionId,
      status: "failed",
      liveViewUrl: null,
      interactiveLiveViewUrl: null,
      connectionMethod: "firecrawl",
      error: session.error || "Failed to create Firecrawl browser session.",
    };
  }

  // Determine starting URL from task and auth intent.
  const startTarget = inferFirecrawlStartUrl(task);
  const targetUrl = startTarget.url;

  // Navigate the Firecrawl browser to the target URL immediately
  try {
    const navCode = `try:\n    await page.goto("${targetUrl}", timeout=30000, wait_until="domcontentloaded")\n    print(await page.title())\nexcept Exception as e:\n    print(f"Nav error: {e}")`;
    await firecrawlExecuteInSession(session.id, navCode, { language: "python", timeout: 35 });
  } catch (navErr) {
    console.warn("Firecrawl session initial navigation failed:", navErr);
  }

  // NOTE: Task execution is now handled by the AI drive loop (browserDriveEngine.ts).
  // The session only navigates to the target URL here. The drive engine will then
  // scan the page and generate step-by-step Playwright code to accomplish the goal.

  const nowIso = new Date().toISOString();
  const liveViewUrl = session.liveViewUrl ?? null;
  const interactiveLiveViewUrl = session.interactiveLiveViewUrl ?? null;

  // Persist session state so getUnifiedBrowserSession finds it
  const persistedSession: PersistedSession = {
    id: formattedSessionId,
    task,
    createdAt: Date.now(),
    userId,
    dedupeKey: options.dedupeKey || null,
    strategy: "goal-seeking",
    connectionMethod: "firecrawl",
    connectionStatus: "connected",
    stdout: [`Firecrawl cloud browser started for ${targetUrl}`],
    stderr: [],
    isRunning: true,
    status: "running",
    currentUrl: targetUrl,
    title: `Firecrawl Cloud Browser — ${targetUrl}`,
    summary: `Active Firecrawl cloud browser session at ${targetUrl}`,
    liveViewUrl,
    interactiveLiveViewUrl,
    actionLog: [
      {
        id: `fc_act_${Date.now()}`,
        action: "firecrawl_start",
        status: "completed",
        message: `Firecrawl session ${formattedSessionId} connected to ${targetUrl}`,
        timestamp: nowIso,
      },
      {
        id: `fc_act_${Date.now()}_intent`,
        action: "intent_resolution",
        status: "completed",
        message:
          startTarget.authIntent === "signup"
            ? "Detected account creation intent. Using signup flow."
            : startTarget.authIntent === "login"
              ? "Detected sign-in intent. Using login flow."
              : "No explicit sign-in/sign-up intent detected. Starting from default page.",
        timestamp: nowIso,
      },
      {
        id: `fc_act_${Date.now()}_navigate`,
        action: "navigate_initial",
        status: "running",
        message: `Opening start page: ${targetUrl}`,
        timestamp: nowIso,
      },
    ],
  };

  writeSession(persistedSession);

  return {
    ok: true,
    id: formattedSessionId,
    status: "running",
    liveViewUrl,
    interactiveLiveViewUrl,
    connectionMethod: "firecrawl",
    expiresAt: session.expiresAt,
  };
}

/**
 * Convert a natural-language browser command into executable Playwright Python code.
 * @deprecated Use the AI drive engine (browserDriveEngine.ts) for intelligent multi-step execution.
 * This function is kept for backward-compatibility with direct `sendCommandToFirecrawlSession` calls.
 */
export function buildPlaywrightCodeForCommand(command: string): string {
  const cmd = command.trim();

  // Direct URL navigation
  if (/^https?:\/\//i.test(cmd)) {
    return `await page.goto("${cmd}", wait_until="domcontentloaded")
title = await page.title()
url = page.url
print(f"Navigated to: {title} ({url})")`;
  }

  // Search query (e.g. "search for X", "find X", "google X")
  const searchMatch = cmd.match(/^(?:search(?:\s+for)?|find|google|look up|look for)\s+(.+)$/i);
  if (searchMatch) {
    const query = encodeURIComponent(searchMatch[1]);
    return `await page.goto("https://www.google.com/search?q=${query}", wait_until="domcontentloaded")
title = await page.title()
print(f"Search results: {title}")`;
  }

  // Click instruction (e.g. "click the Login button", "click on Sign Up")
  const clickMatch = cmd.match(/^click(?:\s+on)?\s+(?:the\s+)?["']?(.+?)["']?(?:\s+button|\s+link)?$/i);
  if (clickMatch) {
    const target = clickMatch[1].trim();
    return `try:
    # Try text-based click first
    await page.get_by_text("${target}", exact=False).first.click()
    print("Clicked: ${target}")
except Exception:
    try:
        await page.locator("button, a, [role='button']").filter(has_text="${target}").first.click()
        print("Clicked via locator: ${target}")
    except Exception as e:
        print(f"Could not click '${target}': {e}")
title = await page.title()
url = page.url
print(f"Now at: {title} ({url})")`;
  }

  // Type / fill instruction (e.g. "type 'hello' in the search box", "fill email with test@test.com")
  const typeMatch = cmd.match(/^(?:type|fill|enter|write)\s+["']?(.+?)["']?\s+(?:in(?:to)?|on)\s+(?:the\s+)?(.+)$/i);
  if (typeMatch) {
    const text = typeMatch[1].trim();
    const targetField = typeMatch[2].trim();
    return `try:
    field = page.get_by_label("${targetField}", exact=False)
    if not await field.count():
        field = page.get_by_placeholder("${targetField}", exact=False)
    if not await field.count():
        field = page.locator("input, textarea").filter(has_text="${targetField}").first
    await field.first.fill("${text}")
    print("Typed '${text}' into '${targetField}'")
except Exception as e:
    print(f"Could not type: {e}")`;
  }

  // Screenshot request
  if (/screenshot|capture|snapshot/i.test(cmd)) {
    return `title = await page.title()
url = page.url
screenshot = await page.screenshot()
import base64
b64 = base64.b64encode(screenshot).decode()
print(f"Screenshot taken on: {title} ({url})")`;
  }

  // Scroll instruction
  const scrollMatch = cmd.match(/^scroll\s*(down|up|to bottom|to top)?/i);
  if (scrollMatch) {
    const dir = (scrollMatch[1] || "down").toLowerCase();
    const scrollAmt = dir.includes("top") ? "0" : "document.body.scrollHeight";
    return `await page.evaluate(f"window.scrollTo(0, ${scrollAmt})")
print("Scrolled ${dir}")`;
  }

  // Go back / forward
  if (/^go\s+back$/i.test(cmd)) {
    return `await page.go_back(wait_until="domcontentloaded")
title = await page.title()
url = page.url
print(f"Went back to: {title} ({url})")`;
  }
  if (/^go\s+forward$/i.test(cmd)) {
    return `await page.go_forward(wait_until="domcontentloaded")
title = await page.title()
url = page.url
print(f"Went forward to: {title} ({url})")`;
  }

  // Generic task — report current state then attempt the task via the page
  return `# Task: ${cmd}
import asyncio
title = await page.title()
url = page.url
print(f"Executing task on: {title} ({url})")
print(f"Task: ${cmd}")
# Attempt to auto-detect and interact with the page for the given task
try:
    # Check if there's a visible input to focus
    inputs = page.locator("input:visible, textarea:visible")
    cnt = await inputs.count()
    if cnt > 0:
        await inputs.first.focus()
    print("Ready for interaction")
except Exception as e:
    print(f"Note: {e}")`;
}

/**
 * Send a command/task to an active Firecrawl Interact session by executing
 * Playwright Python code generated from the natural-language command.
 */
export async function sendCommandToFirecrawlSession(
  sessionId: string,
  command: string,
  options: { timeout?: number } = {}
): Promise<{ ok: boolean; result?: string; error?: string }> {
  const code = buildPlaywrightCodeForCommand(command);

  const result = await firecrawlExecuteInSession(sessionId, code, {
    language: "python",
    timeout: options.timeout ?? 60,
  });

  // Update persisted session action log & stdout
  const existing = readSession(sessionId);
  if (existing) {
    const updated: PersistedSession = {
      ...existing,
      stdout: [...(existing.stdout || []), result.stdout || ""].filter(Boolean),
      stderr: [...(existing.stderr || []), result.stderr || ""].filter(Boolean),
      actionLog: [
        ...(existing.actionLog || []),
        {
          id: `fc_act_${Date.now()}`,
          action: "firecrawl_command",
          status: result.success ? "completed" : "failed",
          message: command,
          timestamp: new Date().toISOString(),
        },
      ],
    };
    writeSession(updated);
  }

  if (!result.success) {
    return {
      ok: false,
      error: result.error || result.stderr || "Command execution failed.",
    };
  }

  return {
    ok: true,
    result: result.stdout || result.result || "Command executed.",
  };
}

/**
 * Close and destroy a Firecrawl Interact browser session.
 */
export async function closeFirecrawlSession(
  sessionId: string
): Promise<{ ok: boolean; error?: string }> {
  const result = await firecrawlDeleteInteractSession(sessionId);
  
  // Update persisted session status
  const existing = readSession(sessionId);
  if (existing) {
    const updated: PersistedSession = {
      ...existing,
      isRunning: false,
      status: "closed",
      exitedAt: Date.now(),
    };
    writeSession(updated);
  }

  if (!result.success) {
    return { ok: false, error: result.error || "Failed to close Firecrawl session." };
  }
  return { ok: true };
}

