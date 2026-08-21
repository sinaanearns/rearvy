import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { condenseMemoryText, isTaskOrLogText, saveMemoryRecord } from "@/lib/memory-store";

type MemorySearchRecord = Record<string, unknown> & {
  content?: unknown;
  memory_type?: unknown;
  importance?: unknown;
  created_at?: unknown;
  is_active?: unknown;
};

function toMemoryRecord(data: Record<string, unknown>): MemorySearchRecord {
  return data;
}

function getImportance(memory: MemorySearchRecord): number {
  return typeof memory.importance === "number" && Number.isFinite(memory.importance)
    ? memory.importance
    : 0;
}

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
        .map((doc) => toMemoryRecord(doc.data() as Record<string, unknown>))
        .filter((memory) => memory.is_active === true);

      if (type !== "all") {
        data = data.filter((memory) => memory.memory_type === type);
      }

      // Filter by query using string matching (since Firestore doesn't have full-text search)
      if (query && query.trim() !== "") {
        const lowerQuery = query.toLowerCase();
        data = data.filter((memory) =>
          typeof memory.content === "string" &&
          memory.content.toLowerCase().includes(lowerQuery)
        );
      }

      // Sort by importance descending
      data.sort((a, b) => getImportance(b) - getImportance(a));

      // Apply limit
      const filtered = data.slice(0, limit);

      let knowledge: string[] = [];
      try {
        const { retrieveKnowledge } = await import("@/lib/knowledge/retriever");
        const results = await retrieveKnowledge({
          userId: ctx.userId,
          query,
          projectId: ctx.projectId,
          limit,
        });
        knowledge = results.map((r) => r.chunk.text);
      } catch (err) {
        // Silently capture error
      }

      return {
        memories: filtered.map((m) => ({
          content: typeof m.content === "string" ? m.content : "",
          type: typeof m.memory_type === "string" ? m.memory_type : "fact",
          importance: getImportance(m),
          createdAt: m.created_at,
        })),
        knowledge,
      };
    },
  });
}

export function saveMemory(ctx: ToolContext) {
  return tool({
    description:
      "Save a concise non-secret fact, preference, goal, credential note, or decision to long-term memory. IMPORTANT: Content MUST be a short, direct single line (e.g. 'Site: shopify.com | User: sinaan@gmail.com | Note: password set by user'). NEVER pass long paragraphs, task prompts, or execution logs.",
    inputSchema: z.object({
      content: z
        .string()
        .describe("Short, direct single-line memory summary to remember"),
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
      if (isTaskOrLogText(content)) {
        return { saved: false, message: "Task execution logs cannot be saved to long-term memory." };
      }
      const condensed = condenseMemoryText(content);
      try {
        const result = await saveMemoryRecord({
          adminDb: ctx.adminDb,
          userId: ctx.userId,
          content: condensed || content,
          memoryType,
          importance,
          tags,
        });

        return { saved: true, id: result.id, created: result.created };
      } catch (error) {
        return { saved: false, message: "Failed to save memory." };
      }
    },
  });
}
