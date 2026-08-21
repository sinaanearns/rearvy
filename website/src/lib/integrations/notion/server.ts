import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { NotionConfig, searchNotion } from "./client";

export interface NotionConnection {
  ok: true;
  integrationId: string;
  config: NotionConfig;
}

export interface NotionConnectionError {
  ok: false;
  errorCode: string;
  message: string;
}

export async function loadNotionConnectionForUser(
  db: Firestore,
  userId: string,
): Promise<NotionConnection | NotionConnectionError> {
  const snapshot = await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", userId)
    .where("provider", "==", "notion")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      ok: false,
      errorCode: "NOTION_NOT_CONNECTED",
      message: "Notion is not connected for this workspace.",
    };
  }

  const doc = snapshot.docs[0];
  const integration = doc.data() as Record<string, unknown>;

  if (!integration.access_token_enc || !integration.token_iv) {
    return {
      ok: false,
      errorCode: "NOTION_AUTH_INCOMPLETE",
      message: "Notion is connected, but the saved OAuth tokens are incomplete.",
    };
  }

  return {
    ok: true,
    integrationId: doc.id,
    config: {
      accessToken: decrypt(
        integration.access_token_enc as string,
        integration.token_iv as string,
      ),
    },
  };
}

export async function searchNotionPages(
  connection: NotionConnection,
  query: string,
  pageSize = 20,
) {
  return searchNotion(connection.config, query, pageSize);
}
