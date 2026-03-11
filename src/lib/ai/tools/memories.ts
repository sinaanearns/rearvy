import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";

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
      const snapshot = await ctx.adminDb
        .collection(COLLECTIONS.MEMORIES)
        .where("user_id", "==", ctx.userId)
        .get();

      let data = snapshot.docs
        .map((doc) => doc.data() as any)
        .filter((m) => m.is_active === true);

      if (type !== "all") {
        data = data.filter((m) => m.memory_type === type);
      }

      // Filter by query using string matching (since Firestore doesn't have full-text search)
      if (query && query.trim() !== "") {
        data = data.filter((m) =>
          m.content.toLowerCase().includes(query.toLowerCase())
        );
      }

      // Sort by importance descending
      data.sort((a, b) => (b.importance || 0) - (a.importance || 0));

      // Apply limit
      const filtered = data.slice(0, limit);

      return {
        memories: filtered.map((m) => ({
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
      try {
        const docRef = await ctx.adminDb
          .collection(COLLECTIONS.MEMORIES)
          .add({
            user_id: ctx.userId,
            content,
            memory_type: memoryType,
            importance,
            tags,
            is_active: true,
            created_at: new Date().toISOString(),
          });

        return { saved: true, id: docRef.id };
      } catch (error) {
        return { saved: false, message: "Failed to save memory." };
      }
    },
  });
}
