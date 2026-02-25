import { tool } from "ai";
import { z } from "zod";
import { SignJWT } from "jose";
import type { ToolContext } from "../types";
import {
  enqueueSyncJob,
  triggerSyncWorker,
  type SyncProvider,
} from "@/lib/integrations/sync-jobs";

export function triggerDataSync(ctx: ToolContext) {
  return tool({
    description:
      "Trigger a data sync for a connected integration. The sync runs in the background and this returns immediately after queueing. Use when the user asks to refresh, sync, or update data from a platform.",
    inputSchema: z.object({
      provider: z
        .enum(["shopify", "youtube", "instagram", "tiktok"])
        .describe("The integration platform to sync"),
    }),
    execute: async ({ provider }) => {
      const { data: integration, error } = await ctx.supabase
        .from("integrations")
        .select("id, status, last_synced_at")
        .eq("user_id", ctx.userId)
        .eq("provider", provider)
        .eq("status", "active")
        .maybeSingle();

      if (error) {
        return {
          ok: false,
          errorCode: "INTEGRATION_LOOKUP_FAILED",
          message: "Could not look up integration status.",
        };
      }

      if (!integration) {
        return {
          ok: false,
          errorCode: "INTEGRATION_NOT_CONNECTED",
          message: `No active ${provider} integration found. Connect it from the Integrations page first.`,
        };
      }

      try {
        await enqueueSyncJob(ctx.supabase, {
          userId: ctx.userId,
          integrationId: integration.id,
          provider: provider as SyncProvider,
        });
      } catch (err) {
        return {
          ok: false,
          errorCode: "SYNC_ENQUEUE_FAILED",
          message: `Failed to queue sync: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
      }

      triggerSyncWorker(provider as SyncProvider);

      return {
        ok: true,
        message: `${provider} sync has been queued and is starting now. Data will refresh in a few minutes.`,
        provider,
        lastSyncedAt: integration.last_synced_at,
      };
    },
  });
}

export function createProject(ctx: ToolContext) {
  return tool({
    description:
      "Create a new project to organize chats and track a business initiative. Use when the user discusses a campaign, product launch, or strategy and wants to formalize it as a project.",
    inputSchema: z.object({
      name: z
        .string()
        .min(1)
        .max(100)
        .describe("Project name, e.g. 'Holiday Campaign 2025'"),
      description: z
        .string()
        .max(500)
        .optional()
        .describe("Brief project description"),
      templateId: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Optional project template ID. Only provide if the user explicitly picks a template."
        ),
    }),
    execute: async ({ name, description, templateId }) => {
      if (templateId) {
        const { data: template } = await ctx.supabase
          .from("project_templates")
          .select("id")
          .eq("id", templateId)
          .eq("is_active", true)
          .maybeSingle();

        if (!template) {
          return {
            ok: false,
            errorCode: "TEMPLATE_NOT_FOUND",
            message:
              "The specified project template was not found or is inactive.",
          };
        }
      }

      const { data: project, error } = await ctx.supabase
        .from("projects")
        .insert({
          user_id: ctx.userId,
          name: name.trim(),
          description: description?.trim() || null,
          template_id: templateId || null,
        })
        .select("id, name, description, template_id, created_at")
        .single();

      if (error) {
        return {
          ok: false,
          errorCode: "PROJECT_CREATE_FAILED",
          message: `Failed to create project: ${error.message}`,
        };
      }

      return {
        ok: true,
        message: `Project "${project.name}" has been created.`,
        project: {
          id: project.id,
          name: project.name,
          description: project.description,
          templateId: project.template_id,
          createdAt: project.created_at,
          url: `/projects/${project.id}`,
        },
      };
    },
  });
}

export function exportData(ctx: ToolContext) {
  return tool({
    description:
      "Generate a CSV export download link for business data. Supports exporting products, orders, YouTube videos, Instagram posts, or TikTok videos. Returns a temporary download URL valid for 15 minutes.",
    inputSchema: z.object({
      dataType: z
        .enum([
          "products",
          "orders",
          "youtube_videos",
          "instagram_posts",
          "tiktok_videos",
        ])
        .describe("The type of data to export"),
      filters: z
        .object({
          periodStart: z
            .string()
            .optional()
            .describe("ISO date filter start"),
          periodEnd: z.string().optional().describe("ISO date filter end"),
          limit: z
            .number()
            .optional()
            .default(1000)
            .describe("Max rows to export (up to 5000)"),
        })
        .optional()
        .default({ limit: 1000 }),
    }),
    execute: async ({ dataType, filters }) => {
      const { count, error } = await ctx.supabase
        .from(dataType)
        .select("id", { count: "exact", head: true })
        .eq("user_id", ctx.userId);

      if (error) {
        return {
          ok: false,
          errorCode: "EXPORT_COUNT_FAILED",
          message: `Could not verify ${dataType} data availability.`,
        };
      }

      if (!count || count === 0) {
        return {
          ok: false,
          errorCode: "NO_DATA_TO_EXPORT",
          message: `No ${dataType.replace(/_/g, " ")} data found to export. Connect the relevant integration and sync data first.`,
        };
      }

      const exportSecret = process.env.SYNC_WORKER_SECRET;
      if (!exportSecret) {
        return {
          ok: false,
          errorCode: "EXPORT_NOT_CONFIGURED",
          message: "Export functionality is not configured on this server.",
        };
      }

      const secret = new TextEncoder().encode(exportSecret);
      const token = await new SignJWT({
        userId: ctx.userId,
        dataType,
        filters: filters || {},
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("15m")
        .setIssuedAt()
        .sign(secret);

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      const downloadUrl = `${appUrl}/api/export/csv?token=${token}`;

      return {
        ok: true,
        message: `Export ready. ${count} ${dataType.replace(/_/g, " ")} records available.`,
        downloadUrl,
        rowCount: count,
        dataType,
        expiresIn: "15 minutes",
      };
    },
  });
}

export function manageInsights(ctx: ToolContext) {
  return tool({
    description:
      "Mark insights as read or dismissed. Can target a specific insight by ID or apply to multiple insights by type. Use after the user reviews insights and wants to clear or acknowledge them.",
    inputSchema: z.object({
      action: z
        .enum(["mark_read", "dismiss"])
        .describe("Whether to mark as read or dismiss entirely"),
      insightId: z
        .string()
        .uuid()
        .optional()
        .describe(
          "Specific insight ID to update. Omit to apply to multiple."
        ),
      insightType: z
        .enum(["all", "anomaly", "trend", "milestone", "opportunity", "risk"])
        .optional()
        .describe(
          "Apply to all insights of this type. Only used when insightId is not provided."
        ),
    }),
    execute: async ({ action, insightId, insightType }) => {
      const updateField =
        action === "mark_read" ? { is_read: true } : { is_dismissed: true };

      if (insightId) {
        const { data, error } = await ctx.supabase
          .from("insights")
          .update(updateField)
          .eq("id", insightId)
          .eq("user_id", ctx.userId)
          .select("id, title")
          .maybeSingle();

        if (error) {
          return {
            ok: false,
            errorCode: "INSIGHT_UPDATE_FAILED",
            message: `Failed to update insight: ${error.message}`,
          };
        }

        if (!data) {
          return {
            ok: false,
            errorCode: "INSIGHT_NOT_FOUND",
            message: "Insight not found or does not belong to you.",
          };
        }

        return {
          ok: true,
          message: `Insight "${data.title}" has been ${action === "mark_read" ? "marked as read" : "dismissed"}.`,
          updatedCount: 1,
        };
      }

      let query = ctx.supabase
        .from("insights")
        .update(updateField)
        .eq("user_id", ctx.userId);

      if (action === "mark_read") {
        query = query.eq("is_read", false);
      } else {
        query = query.eq("is_dismissed", false);
      }

      if (insightType && insightType !== "all") {
        query = query.eq("insight_type", insightType);
      }

      const { data, error } = await query.select("id");

      if (error) {
        return {
          ok: false,
          errorCode: "INSIGHT_BULK_UPDATE_FAILED",
          message: `Failed to update insights: ${error.message}`,
        };
      }

      const updatedCount = data?.length || 0;
      const label =
        insightType && insightType !== "all" ? `${insightType} ` : "";
      return {
        ok: true,
        message: `${updatedCount} ${label}insights ${action === "mark_read" ? "marked as read" : "dismissed"}.`,
        updatedCount,
      };
    },
  });
}

export function deleteMemory(ctx: ToolContext) {
  return tool({
    description:
      "Delete (deactivate) a stored memory. Use when the user says a saved fact is outdated, wrong, or no longer relevant. Always call searchMemories first to find the correct memory ID.",
    inputSchema: z.object({
      memoryId: z
        .string()
        .uuid()
        .describe(
          "The ID of the memory to delete. Use searchMemories first to find it."
        ),
    }),
    execute: async ({ memoryId }) => {
      const { data: memory, error: lookupError } = await ctx.supabase
        .from("memories")
        .select("id, content, memory_type")
        .eq("id", memoryId)
        .eq("user_id", ctx.userId)
        .eq("is_active", true)
        .maybeSingle();

      if (lookupError) {
        return {
          ok: false,
          errorCode: "MEMORY_LOOKUP_FAILED",
          message: "Could not look up the memory.",
        };
      }

      if (!memory) {
        return {
          ok: false,
          errorCode: "MEMORY_NOT_FOUND",
          message:
            "Memory not found, already deleted, or does not belong to you.",
        };
      }

      const { error: updateError } = await ctx.supabase
        .from("memories")
        .update({ is_active: false })
        .eq("id", memoryId)
        .eq("user_id", ctx.userId);

      if (updateError) {
        return {
          ok: false,
          errorCode: "MEMORY_DELETE_FAILED",
          message: `Failed to delete memory: ${updateError.message}`,
        };
      }

      return {
        ok: true,
        message: `Memory deleted: "${memory.content.substring(0, 80)}${memory.content.length > 80 ? "..." : ""}"`,
        deletedMemory: {
          id: memory.id,
          content: memory.content,
          type: memory.memory_type,
        },
      };
    },
  });
}
