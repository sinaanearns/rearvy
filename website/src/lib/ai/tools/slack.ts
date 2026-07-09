import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";
import {
  loadSlackConnectionForUser,
  fetchSlackChannels,
  fetchSlackChannelHistory,
} from "@/lib/integrations/slack/server";
import {
  slackPostMessage,
  type SlackConfig,
} from "@/lib/integrations/slack/client";

const log = createServerLogger("SlackTool");

export function sendSlackMessage(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Send a message to a Slack channel or user. Requires Slack to be connected. Always prefer drafting for sensitive announcements unless the user explicitly asks to send.",
    inputSchema: z.object({
      channel: z.string().describe("Slack channel ID (starts with C) or user ID (starts with U, D, or W)."),
      text: z.string().describe("The message text to send."),
      threadTs: z.string().optional().describe("Optional thread timestamp to reply within a thread."),
    }),
    execute: async ({ channel, text, threadTs }) => {
      const connection = await loadSlackConnectionForUser(adminDb, ctx.userId);
      if (!connection.ok) {
        return { ok: false, error: connection.message, errorCode: connection.errorCode };
      }

      const result = await slackPostMessage(
        connection.config as SlackConfig,
        channel,
        text,
        threadTs,
      );

      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      return {
        ok: true,
        channel,
        ts: result.ts,
        text,
        message: "Message sent to Slack.",
      };
    },
  });
}

export function listSlackChannels(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "List the Slack channels the connected workspace can access. Requires Slack to be connected.",
    inputSchema: z.object({}),
    execute: async () => {
      const connection = await loadSlackConnectionForUser(adminDb, ctx.userId);
      if (!connection.ok) {
        return { ok: false, error: connection.message, errorCode: connection.errorCode };
      }

      const channels = await fetchSlackChannels(connection);
      return {
        ok: true,
        channels: channels.map((c) => ({
          id: c.id,
          name: c.name,
          isPrivate: c.isPrivate,
          numMembers: c.numMembers,
        })),
        message: `Found ${channels.length} Slack channels.`,
      };
    },
  });
}

export function readSlackChannel(ctx: ToolContext) {
  void ctx;
  return tool({
    description:
      "Read recent messages from a Slack channel. Requires Slack to be connected.",
    inputSchema: z.object({
      channel: z.string().describe("Slack channel ID to read."),
      limit: z.number().int().min(1).max(200).default(50).describe("Number of messages to read."),
    }),
    execute: async ({ channel, limit }) => {
      const connection = await loadSlackConnectionForUser(adminDb, ctx.userId);
      if (!connection.ok) {
        return { ok: false, error: connection.message, errorCode: connection.errorCode };
      }

      const messages = await fetchSlackChannelHistory(connection, channel, limit);
      return {
        ok: true,
        channel,
        messages: messages.map((m) => ({
          ts: m.ts,
          user: m.user,
          text: m.text,
        })),
        message: `Read ${messages.length} messages from Slack channel ${channel}.`,
      };
    },
  });
}
