import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import {
  SlackConfig,
  SlackChannel,
  SlackMessage,
  listSlackChannels,
  readSlackChannelHistory,
} from "./client";

export interface SlackConnection {
  ok: true;
  integrationId: string;
  config: SlackConfig;
  teamName: string;
}

export interface SlackConnectionError {
  ok: false;
  errorCode: string;
  message: string;
}

export async function loadSlackConnectionForUser(
  db: Firestore,
  userId: string,
): Promise<SlackConnection | SlackConnectionError> {
  const snapshot = await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", userId)
    .where("provider", "==", "slack")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      ok: false,
      errorCode: "SLACK_NOT_CONNECTED",
      message: "Slack is not connected for this workspace.",
    };
  }

  const doc = snapshot.docs[0];
  const integration = doc.data() as Record<string, unknown>;

  if (!integration.access_token_enc || !integration.token_iv) {
    return {
      ok: false,
      errorCode: "SLACK_AUTH_INCOMPLETE",
      message: "Slack is connected, but the saved OAuth tokens are incomplete.",
    };
  }

  const accessToken = decrypt(
    integration.access_token_enc as string,
    integration.token_iv as string,
  );

  return {
    ok: true,
    integrationId: doc.id,
    config: {
      accessToken,
      botUserId: integration.provider_account_id
        ? String(integration.provider_account_id)
        : undefined,
      teamId: integration.provider_account_name
        ? String(integration.provider_account_name)
        : undefined,
    },
    teamName: integration.provider_account_name
      ? String(integration.provider_account_name)
      : "Slack",
  };
}

export async function fetchSlackChannels(
  connection: SlackConnection,
): Promise<SlackChannel[]> {
  return listSlackChannels(connection.config);
}

export async function fetchSlackChannelHistory(
  connection: SlackConnection,
  channel: string,
  limit = 50,
): Promise<SlackMessage[]> {
  return readSlackChannelHistory(connection.config, channel, limit);
}
