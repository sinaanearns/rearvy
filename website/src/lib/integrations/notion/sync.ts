import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { NotionConfig, NotionPage } from "./client";

function stableDocId(...parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("__");
}

async function commitBatchIfNeeded(batch: WriteBatch, writeCount: number) {
  if (writeCount > 0) {
    await batch.commit();
  }
}

export async function runNotionSync(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: NotionConfig,
  pages: NotionPage[],
) {
  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .set({ last_synced_at: new Date().toISOString() }, { merge: true });

  let batch = db.batch();
  let writeCount = 0;

  for (const page of pages) {
    const pageRef = db
      .collection(COLLECTIONS.NOTION_PAGES)
      .doc(stableDocId(integrationId, page.id));

    batch.set(pageRef, {
      user_id: userId,
      integration_id: integrationId,
      page_id: page.id,
      title: page.title,
      url: page.url,
      parent: page.parent ?? null,
      last_edited_at: page.lastEditedAt ?? null,
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
  return { pages: pages.length };
}
