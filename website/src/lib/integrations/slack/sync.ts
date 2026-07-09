import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { SlackConfig, SlackChannel } from "./client";

function stableDocId(...parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("__");
}

async function commitBatchIfNeeded(batch: WriteBatch, writeCount: number) {
  if (writeCount > 0) {
    await batch.commit();
  }
}

export async function runSlackSync(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: SlackConfig,
  channels: SlackChannel[],
) {
  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .set(
      {
        last_synced_at: new Date().toISOString(),
      },
      { merge: true },
    );

  let batch = db.batch();
  let writeCount = 0;

  for (const channel of channels) {
    const channelRef = db
      .collection(COLLECTIONS.SLACK_CHANNELS)
      .doc(stableDocId(integrationId, channel.id));

    batch.set(channelRef, {
      user_id: userId,
      integration_id: integrationId,
      channel_id: channel.id,
      name: channel.name,
      is_private: channel.isPrivate,
      is_archived: channel.isArchived,
      num_members: channel.numMembers ?? null,
      topic: channel.topic ?? null,
      purpose: channel.purpose ?? null,
      synced_at: new Date().toISOString(),
    });

    writeCount += 1;
    if (writeCount >= 450) {
      await batch.commit();
      batch = db.batch();
      writeCount = 0;
    }
  }

  await commitBatchIfNeeded(batch, writeCount);

  return { channels: channels.length };
}
