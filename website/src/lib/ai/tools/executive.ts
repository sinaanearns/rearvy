import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { runExecutiveRequest } from "@/lib/executive/engine";

export function executiveRun(ctx: ToolContext) {
  return tool({
    description:
      "Execute a real-world goal end-to-end through the Rearvy Executive Engine: understand, plan, execute, verify, recover, learn, and report. Use this for open-ended execution requests such as 'launch my Chrome extension', 'reply to all important emails', or 'research my competitors and make a presentation'. The engine breaks the request into steps, runs wired capabilities, verifies each result, retries on failure, and returns a concise completion report.",
    inputSchema: z.object({
      request: z
        .string()
        .describe("The natural-language goal the user wants accomplished."),
      approvedStepIds: z
        .array(z.string())
        .optional()
        .default([])
        .describe(
          "Ids of steps the user has explicitly approved for irreversible or externally visible actions.",
        ),
    }),
    execute: async ({ request, approvedStepIds }) => {
      const result = await runExecutiveRequest({
        request,
        userId: ctx.userId,
        projectId: ctx.projectId,
        chatId: ctx.chatId,
        approvedStepIds,
      });
      return result;
    },
  });
}
