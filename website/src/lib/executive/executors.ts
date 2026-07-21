import type { Firestore } from "firebase-admin/firestore";
import type { ToolContext } from "@/lib/ai/types";
import type { GmailConfig } from "@/lib/integrations/gmail/client";
import type { GmailComposePayload, GmailSendAsOption } from "@/lib/integrations/gmail/compose-shared";
import { adminDb } from "@/lib/firebase/admin";
import { ingestDocument } from "@/lib/knowledge/ingestion-pipeline";
import { createProcessSession } from "@/lib/work/processes";
import type { ExecutionStep, ExecutorResult, ExecutorContext } from "./types";

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function makeToolCtx(ctx: ExecutorContext): ToolContext {
  return {
    userId: ctx.userId,
    adminDb: ctx.adminDb,
    projectId: ctx.projectId ?? null,
    chatId: null,
    isDesktopApp: ctx.isDesktopApp ?? false,
  };
}

type AnyTool = { execute?: (args: Record<string, unknown>, opts: unknown) => Promise<unknown> };

async function callTool(tool: unknown, args: Record<string, unknown>): Promise<unknown> {
  const t = tool as AnyTool;
  if (typeof t.execute !== "function") {
    throw new Error("tool has no execute implementation");
  }
  return t.execute(args, {});
}

/**
 * Real executors delegate to existing, production code paths (the same tool
 * factories and integration libs the chat already uses). Capabilities with no
 * backend in this codebase return an honest `unsupported` result.
 */
export const EXECUTORS: Record<string, Executor> = {
  async "knowledge.learn"(step, ctx): Promise<ExecutorResult> {
    const text = readString(step.params.text, readString(step.params.content));
    const title = readString(step.params.title, "Learned workflow");
    if (!text) {
      return { ok: false, status: "failed", detail: "knowledge.learn missing text." };
    }
    const docId = await ingestDocument({
      userId: ctx.userId,
      projectId: ctx.projectId ?? null,
      title,
      sourceType: "text",
      sourceIdentifier: "executive-engine",
      text,
    });
    return {
      ok: true,
      status: "succeeded",
      detail: `Stored playbook in knowledge base (${docId}).`,
      data: { docId },
    };
  },

  async "work.process.create"(step, ctx): Promise<ExecutorResult> {
    const goal = readString(step.params.goal, readString(step.params.command, step.intent));
    if (!goal) {
      return { ok: false, status: "failed", detail: "work.process.create missing goal." };
    }
    const process = await createProcessSession(ctx.adminDb, ctx.userId, {
      command: goal,
      autoExecuteEnabled: false,
      trustedScope: "executive",
    });
    return {
      ok: true,
      status: "succeeded",
      detail: "Queued a work automation process session.",
      data: { processId: (process as { id?: string })?.id },
    };
  },

  async "email.reply"(step, ctx): Promise<ExecutorResult> {
    const { getRecentGmailMessages, draftGmailReply } = await import("@/lib/ai/tools/gmail");
    const toolCtx = makeToolCtx(ctx);
    const limit = Number(step.params.limit ?? step.params.max ?? 8);
    const inbox = (await callTool(getRecentGmailMessages(toolCtx), {
      limit,
      days: Number(step.params.days ?? 7),
      category: readString(step.params.category),
      sentiment: readString(step.params.sentiment),
    })) as { messages?: Array<Record<string, unknown>> };
    const messages = inbox.messages ?? [];
    let drafted = 0;
    for (const m of messages.slice(0, limit)) {
      const threadId = readString(m.threadId ?? m.id);
      if (!threadId) continue;
      try {
        const r = await callTool(draftGmailReply(toolCtx), {
          threadId,
          query: readString(step.params.query),
        });
        if (r && (r as { draftId?: string }).draftId) drafted++;
      } catch {
        /* keep drafting remaining emails */
      }
    }
    return {
      ok: drafted > 0,
      status: drafted > 0 ? "succeeded" : "skipped",
      detail: `Drafted replies for ${drafted} email(s).`,
      data: { drafted },
    };
  },

  async "email.send"(step, ctx): Promise<ExecutorResult> {
    const {
      loadGmailConnectionForUser,
      loadGmailSendAsOptions,
      pickDefaultSendAsOption,
      sendGmailMessage,
    } = await import("@/lib/integrations/gmail/server");
    const conn = (await loadGmailConnectionForUser(ctx.adminDb, ctx.userId)) as {
      ok: boolean;
      config?: GmailConfig;
      integrationId?: string;
    };
    if (!conn.ok || !conn.config) {
      return { ok: false, status: "unsupported", detail: "Gmail is not connected." };
    }
    const sendAsResult = (await loadGmailSendAsOptions(conn as never)) as {
      options: GmailSendAsOption[];
    };
    const from = pickDefaultSendAsOption(sendAsResult.options);
    if (!from) {
      return { ok: false, status: "failed", detail: "No Gmail send-as identity available." };
    }
    const draft = {
      to: [readString(step.params.to)],
      cc: [],
      bcc: [],
      subject: readString(step.params.subject),
      body: readString(step.params.body, readString(step.params.content)),
    } as GmailComposePayload;
    if (!draft.to[0] || !draft.subject) {
      return { ok: false, status: "failed", detail: "email.send requires to + subject." };
    }
    const res = await sendGmailMessage({ config: conn.config, draft, from });
    const id = (res as { id?: string }).id;
    return {
      ok: Boolean(id),
      status: id ? "succeeded" : "failed",
      detail: id ? `Sent message ${id}.` : "Send failed.",
      data: res as Record<string, unknown>,
    };
  },

  async "calendar.create"(step, ctx): Promise<ExecutorResult> {
    const { createCalendarEvent } = await import("@/lib/ai/tools/calendar");
    const r = (await callTool(createCalendarEvent(makeToolCtx(ctx)), {
      summary: readString(step.params.summary, step.intent),
      description: readString(step.params.description),
      startTime: readString(step.params.startTime ?? step.params.start),
      endTime: readString(step.params.endTime ?? step.params.end),
      location: readString(step.params.location),
    })) as { eventId?: string; id?: string };
    return {
      ok: Boolean(r.eventId ?? r.id),
      status: r.eventId || r.id ? "succeeded" : "failed",
      detail: (r.eventId ?? r.id)
        ? `Created calendar event ${(r.eventId ?? r.id) as string}.`
        : "Calendar event creation returned no id.",
      data: r as Record<string, unknown>,
    };
  },

  async "browser.navigate"(step, ctx): Promise<ExecutorResult> {
    const { runBrowserTask } = await import("@/lib/ai/tools/browser");
    const r = await callTool(runBrowserTask(makeToolCtx(ctx)), {
      task: readString(step.params.task, step.intent),
      stealthMode: step.params.stealthMode === true || step.params.stealthMode === "true",
      proxy: readString(step.params.proxy) || undefined,
    });
    return {
      ok: Boolean(r),
      status: r ? "succeeded" : "failed",
      detail: "Browser task executed.",
      data: r as Record<string, unknown>,
    };
  },

  async "browser.automate"(step, ctx): Promise<ExecutorResult> {
    return EXECUTORS["browser.navigate"](step, ctx);
  },

  async "code.run"(step, ctx): Promise<ExecutorResult> {
    if (!ctx.isDesktopApp) {
      return {
        ok: false,
        status: "unsupported",
        detail:
          "code.run requires the Rearvy desktop app. Shell commands are not executed on the hosted server.",
      };
    }
    const { runTerminalCommand } = await import("@/lib/ai/tools/terminal");
    const command = readString(step.params.command, readString(step.params.script));
    if (!command) {
      return { ok: false, status: "failed", detail: "code.run missing command." };
    }
    const r = await callTool(runTerminalCommand(makeToolCtx(ctx)), {
      command,
      cwd: readString(step.params.cwd) || undefined,
    });
    return {
      ok: Boolean(r),
      status: r ? "succeeded" : "failed",
      detail: "Command executed.",
      data: r as Record<string, unknown>,
    };
  },

  async "desktop.terminal"(step, ctx): Promise<ExecutorResult> {
    if (!ctx.isDesktopApp) {
      return {
        ok: false,
        status: "unsupported",
        detail: "desktop.terminal requires the Rearvy desktop app to be connected.",
      };
    }
    return EXECUTORS["code.run"](step, ctx);
  },

  async "file.write"(step, ctx): Promise<ExecutorResult> {
    const content = readString(step.params.content, readString(step.params.text));
    const filePath = readString(step.params.path ?? step.params.filePath);
    if (!content) {
      return { ok: false, status: "failed", detail: "file.write missing content." };
    }
    if (ctx.isDesktopApp && filePath) {
      const { writeFileTool } = await import("@/lib/ai/tools/terminal");
      const r = await callTool(writeFileTool(makeToolCtx(ctx)), { filePath, content });
      return {
        ok: Boolean(r),
        status: r ? "succeeded" : "failed",
        detail: `Wrote file ${filePath}.`,
        data: r as Record<string, unknown>,
      };
    }
    const { uploadCloudFile } = await import("@/lib/ai/tools/storage");
    const r = await callTool(uploadCloudFile(makeToolCtx(ctx)), {
      filePath: filePath || readString(step.params.name, "executive-output.txt"),
      content,
    });
    return {
      ok: Boolean(r),
      status: r ? "succeeded" : "failed",
      detail: "Uploaded file to cloud storage.",
      data: r as Record<string, unknown>,
    };
  },

  async "integration.sync"(step, ctx): Promise<ExecutorResult> {
    const provider = readString(step.params.provider ?? step.params.integration, "gmail");
    if (provider !== "gmail") {
      return {
        ok: false,
        status: "unsupported",
        detail: `Sync for "${provider}" is not wired as a direct executor; use its integration connect/sync route.`,
      };
    }
    const { loadGmailConnectionForUser } = await import("@/lib/integrations/gmail/server");
    const { runFullSync } = await import("@/lib/integrations/gmail/sync");
    const conn = (await loadGmailConnectionForUser(ctx.adminDb, ctx.userId)) as {
      ok: boolean;
      config?: GmailConfig;
      integrationId?: string;
    };
    if (!conn.ok || !conn.config || !conn.integrationId) {
      return { ok: false, status: "unsupported", detail: "Gmail is not connected." };
    }
    const res = await runFullSync(ctx.adminDb, ctx.userId, conn.integrationId, conn.config);
    return {
      ok: true,
      status: "succeeded",
      detail: "Synced Gmail data.",
      data: res as Record<string, unknown>,
    };
  },
};

export type Executor = (
  step: ExecutionStep,
  ctx: ExecutorContext,
) => Promise<ExecutorResult>;

export function getExecutor(capability: string): Executor | null {
  return EXECUTORS[capability] ?? null;
}

/** Capabilities with no backend in this codebase yet — reported honestly. */
export const UNSUPPORTED_CAPABILITIES = new Set<string>([
  "desktop.launch",
  "office.presentation",
  "crm.upsert",
  "cloud.deploy",
  "design.export",
]);
