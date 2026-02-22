import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";

export function searchMemories(ctx: ToolContext) {
  return tool({
    description:
      "Search through saved memories and context for relevant information",
    inputSchema: z.object({
      query: z.string().describe("Search query to find relevant memories"),
      type: z
        .enum(["all", "fact", "preference", "goal", "decision", "context"])
        .optional()
        .default("all"),
      limit: z.number().optional().default(5),
    }),
    execute: async ({ query, type, limit }) => {
      let dbQuery = ctx.supabase
        .from("memories")
        .select("content, memory_type, importance, created_at")
        .eq("user_id", ctx.userId)
        .eq("is_active", true)
        .ilike("content", `%${query}%`)
        .order("importance", { ascending: false })
        .limit(limit);

      if (type !== "all") {
        dbQuery = dbQuery.eq("memory_type", type);
      }

      const { data } = await dbQuery;

      return {
        memories: (data || []).map((m) => ({
          content: m.content,
          type: m.memory_type,
          importance: m.importance,
          createdAt: m.created_at,
        })),
      };
    },
  });
}

export function saveMemory(ctx: ToolContext) {
  return tool({
    description:
      "Save an important fact, preference, goal, or decision to long-term memory so it can be recalled in future conversations",
    inputSchema: z.object({
      content: z
        .string()
        .describe("The fact, preference, or decision to remember"),
      memoryType: z.enum([
        "fact",
        "preference",
        "goal",
        "decision",
        "context",
      ]),
      importance: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .default(5)
        .describe("1-10 importance scale, 10 being most important"),
      tags: z.array(z.string()).optional().default([]),
    }),
    execute: async ({ content, memoryType, importance, tags }) => {
      const { data, error } = await ctx.supabase
        .from("memories")
        .insert({
          user_id: ctx.userId,
          content,
          memory_type: memoryType,
          importance,
          tags,
        })
        .select("id")
        .single();

      if (error) {
        return { saved: false, message: "Failed to save memory." };
      }

      return { saved: true, id: data.id };
    },
  });
}
