import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export function executionRun(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Execute a user's natural language goal using Rearvy's unified execution brain. The brain parses intent, decides whether to run a single tool or a multi-step orchestration plan, executes it, and returns a structured result. Use this when the user's request is vague, complex, or spans multiple capabilities (e.g., 'read my invoices, summarize them, upload to Drive and email the accountant').",
    inputSchema: z.object({
      goal: z.string().describe("The user's original natural language goal to execute."),
      approvalMode: z
        .enum(["auto", "require_all", "safe_only"])
        .default("auto")
        .describe(
          "How approval gates are handled. Use auto to follow the default policy, require_all to pause for every step, and safe_only to only allow pre-approved safe steps."
        ),
      maxSteps: z
        .number()
        .int()
        .min(1)
        .max(12)
        .default(10)
        .describe("Maximum number of steps the execution plan may contain."),
    }),
    execute: async ({ goal }) => {
      const { executeGoal } = await import("@/lib/ai/execution/brain");

    const result = await executeGoal(goal, {
      userId: ctx.userId,
      projectId: ctx.projectId ?? null,
      chatId: ctx.chatId ?? null,
      isDesktopApp: ctx.isDesktopApp ?? false,
    });

      return {
        ok: true,
        execution: {
          goal: result.understood,
          intent: result.intent,
          plan: result.plan,
          steps: result.steps,
          summary: result.summary,
          confidence: result.confidence,
          needsApproval: result.needsApproval,
          error: result.error ?? null,
        },
      };
    },
  });
}
