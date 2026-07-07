import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { adminStorage } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("StorageTool");

/** Helper to get user's isolated bucket path prefix */
function getUserStoragePrefix(userId: string): string {
  return `users/${userId}/`;
}

export function listCloudFiles(ctx: ToolContext) {
  return tool({
    description: "List files stored in your isolated cloud workspace",
    inputSchema: z.object({
      prefix: z
        .string()
        .optional()
        .describe("Optional path prefix to filter files (e.g. 'reports/')"),
    }),
    execute: async ({ prefix = "" }) => {
      try {
        const bucket = adminStorage.bucket();
        const userPrefix = getUserStoragePrefix(ctx.userId) + prefix;
        const [files] = await bucket.getFiles({ prefix: userPrefix });

        const fileList = files.map((file) => ({
          name: file.name.substring(getUserStoragePrefix(ctx.userId).length),
          sizeBytes: file.metadata.size,
          contentType: file.metadata.contentType,
          updatedAt: file.metadata.updated,
        }));

        return {
          ok: true,
          files: fileList,
        };
      } catch (error) {
        log.error("Failed to list cloud files", error);
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Listing failed",
        };
      }
    },
  });
}

export function uploadCloudFile(ctx: ToolContext) {
  return tool({
    description: "Upload a text or document file to your isolated cloud workspace",
    inputSchema: z.object({
      filePath: z.string().describe("Target cloud path (e.g. 'reports/summary.txt')"),
      content: z.string().describe("File content string to write"),
      mimeType: z
        .string()
        .optional()
        .default("text/plain")
        .describe("MIME type for file validation (e.g. 'text/plain', 'text/markdown', 'application/json')"),
    }),
    execute: async ({ filePath, content, mimeType }) => {
      // Validate MIME type safety
      const allowedMimes = [
        "text/plain",
        "text/markdown",
        "text/csv",
        "text/html",
        "application/json",
        "application/xml",
      ];
      if (!allowedMimes.includes(mimeType)) {
        return {
          ok: false,
          error: `MIME type ${mimeType} is not allowed. Supported text types: ${allowedMimes.join(", ")}`,
        };
      }

      try {
        const bucket = adminStorage.bucket();
        const destination = getUserStoragePrefix(ctx.userId) + filePath.replace(/^\//, "");
        const file = bucket.file(destination);

        await file.save(content, {
          metadata: {
            contentType: mimeType,
          },
        });

        log.info(`Cloud file uploaded: ${destination}`);
        return {
          ok: true,
          filePath,
          message: `Successfully uploaded ${content.length} characters to cloud workspace path ${filePath}`,
        };
      } catch (error) {
        log.error("Failed to upload cloud file", error);
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Upload failed",
        };
      }
    },
  });
}

export function downloadCloudFile(ctx: ToolContext) {
  return tool({
    description: "Generate a secure access URL to retrieve a file from your cloud workspace",
    inputSchema: z.object({
      filePath: z.string().describe("Path of the file in your cloud workspace"),
    }),
    execute: async ({ filePath }) => {
      try {
        const bucket = adminStorage.bucket();
        const targetPath = getUserStoragePrefix(ctx.userId) + filePath.replace(/^\//, "");
        const file = bucket.file(targetPath);

        const [exists] = await file.exists();
        if (!exists) {
          return {
            ok: false,
            error: `File ${filePath} not found in cloud workspace`,
          };
        }

        // Generate signed URL valid for 1 hour
        const [url] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + 60 * 60 * 1000, // 1 hour
        });

        return {
          ok: true,
          filePath,
          downloadUrl: url,
        };
      } catch (error) {
        log.error("Failed to generate download URL", error);
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Download failed",
        };
      }
    },
  });
}
