import type {
  DocumentData,
  QuerySnapshot,
  WriteBatch,
} from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

/**
 * Shared Firestore helpers for integration "disconnect" routes. Every provider
 * disconnect removes the integration document(s) plus related synced data, and
 * these building blocks capture the repeated query/batch-delete patterns.
 */

/** Firestore batches accept at most 500 writes; stay comfortably under. */
const DELETE_CHUNK_SIZE = 400;

/** Page size for the paginated {@link deleteMatchingDocs} loop. */
const DELETE_PAGE_SIZE = 250;

/**
 * Delete every document in `collectionName` where `fieldName == fieldValue`,
 * paging through results so arbitrarily large collections are handled safely.
 * Returns the number of documents deleted.
 */
export async function deleteMatchingDocs(
  collectionName: string,
  fieldName: string,
  fieldValue: string
): Promise<number> {
  let deletedCount = 0;

  while (true) {
    const snapshot = await adminDb
      .collection(collectionName)
      .where(fieldName, "==", fieldValue)
      .limit(DELETE_PAGE_SIZE)
      .get();

    if (snapshot.empty) {
      break;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount += 1;
    });
    await batch.commit();

    if (snapshot.size < DELETE_PAGE_SIZE) {
      break;
    }
  }

  return deletedCount;
}

/** Delete every document in a snapshot using chunked write batches. */
export async function deleteSnapshotInChunks(
  snapshot: QuerySnapshot<DocumentData>,
  chunkSize: number = DELETE_CHUNK_SIZE
): Promise<void> {
  for (let index = 0; index < snapshot.docs.length; index += chunkSize) {
    const batch = adminDb.batch();
    const chunk = snapshot.docs.slice(index, index + chunkSize);
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

/** Fetch the integration document(s) for a given user and provider. */
export function getUserProviderIntegrations(
  uid: string,
  provider: string
): Promise<QuerySnapshot<DocumentData>> {
  return adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", uid)
    .where("provider", "==", provider)
    .get();
}

/**
 * Queue deletes for every document in `collectionName` scoped to `uid`
 * (`user_id == uid`) onto an existing write batch.
 */
export async function addUserScopedDeletes(
  batch: WriteBatch,
  collectionName: string,
  uid: string
): Promise<void> {
  const snapshot = await adminDb
    .collection(collectionName)
    .where("user_id", "==", uid)
    .get();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
}

/**
 * Queue deletes for the integration sync jobs tied to an integration id and
 * provider onto an existing write batch.
 */
export async function addSyncJobDeletes(
  batch: WriteBatch,
  integrationId: string,
  provider: string
): Promise<void> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
    .where("integration_id", "==", integrationId)
    .where("provider", "==", provider)
    .get();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
}
