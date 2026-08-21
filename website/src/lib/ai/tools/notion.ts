import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { adminDb } from "@/lib/firebase/admin";
import {
  loadNotionConnectionForUser,
  searchNotionPages,
} from "@/lib/integrations/notion/server";
import {
  createNotionPage,
  appendNotionBlock,
  type NotionConfig,
} from "@/lib/integrations/notion/client";

export function searchNotionTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Search the user's connected Notion workspace for pages matching a query. Requires Notion to be connected.",
    inputSchema: z.object({
      query: z.string().describe("Free-text search query for Notion pages."),
      pageSize: z.number().int().min(1).max(100).default(20),
    }),
    execute: async ({ query, pageSize }) => {
      const connection = await loadNotionConnectionForUser(adminDb, ctx.userId);
      if (!connection.ok) {
        return { ok: false, error: connection.message, errorCode: connection.errorCode };
      }

      const pages = await searchNotionPages(connection, query, pageSize);
      return {
        ok: true,
        pages: pages.map((p) => ({ id: p.id, title: p.title, url: p.url })),
        message: `Found ${pages.length} Notion pages for "${query}".`,
      };
    },
  });
}

export function createNotionPageTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Create a new page inside a Notion parent page. Requires Notion to be connected. Use for meeting notes, docs, or knowledge base entries.",
    inputSchema: z.object({
      parentPageId: z.string().describe("The ID of the Notion parent page."),
      title: z.string().describe("Title of the new page."),
      content: z.string().optional().describe("Optional body text for the new page."),
    }),
    execute: async ({ parentPageId, title, content }) => {
      const connection = await loadNotionConnectionForUser(adminDb, ctx.userId);
      if (!connection.ok) {
        return { ok: false, error: connection.message, errorCode: connection.errorCode };
      }

      const result = await createNotionPage(
        connection.config as NotionConfig,
        parentPageId,
        title,
        content,
      );

      return {
        ok: true,
        pageId: result.id,
        url: result.url,
        message: `Created Notion page "${title}".`,
      };
    },
  });
}

export function updateNotionPageTool(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Append a paragraph block to an existing Notion page. Requires Notion to be connected.",
    inputSchema: z.object({
      pageId: z.string().describe("The ID of the Notion page to update."),
      content: z.string().describe("Text to append to the page."),
    }),
    execute: async ({ pageId, content }) => {
      const connection = await loadNotionConnectionForUser(adminDb, ctx.userId);
      if (!connection.ok) {
        return { ok: false, error: connection.message, errorCode: connection.errorCode };
      }

      await appendNotionBlock(connection.config as NotionConfig, pageId, content);
      return {
        ok: true,
        pageId,
        message: `Appended content to Notion page ${pageId}.`,
      };
    },
  });
}
