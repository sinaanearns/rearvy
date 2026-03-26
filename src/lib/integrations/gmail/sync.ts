import { Firestore } from "firebase-admin/firestore";
import {
  GmailConfig,
  ensureValidToken,
  fetchThreads,
  fetchThreadDetails,
  extractTextBody,
  getHeader,
} from "./client";
import { COLLECTIONS, GmailMessage, GmailThread } from "@/lib/firebase/schema";

const MAX_THREADS_PER_SYNC = 50; // Keep it small to avoid hitting API limits or timeouts

export async function runFullSync(
  adminDb: Firestore,
  userId: string,
  integrationId: string,
  config: GmailConfig
) {
  // 1. Ensure token is valid
  const accessToken = await ensureValidToken(adminDb, integrationId, config);
  const activeConfig = { ...config, accessToken };

  // 2. Fetch integration cursor
  const integrationRef = adminDb.collection(COLLECTIONS.INTEGRATIONS).doc(integrationId);
  const integrationSnap = await integrationRef.get();
  const integration = integrationSnap.data();

  // We use historyId for incremental sync if available, but for now we'll just do a basic pageToken/time-based sync
  // Actually, Gmail API requires historyId for efficient syncs, but threads.list is easier for initial MVP.
  // We'll just fetch the latest N threads.
  
  const { threads: rawThreads } = await fetchThreads(activeConfig, undefined, MAX_THREADS_PER_SYNC);
  
  let syncedThreadsCount = 0;
  let syncedMessagesCount = 0;

  const batch = adminDb.batch();
  let batchSize = 0;

  const commitBatchIfNeeded = async () => {
    if (batchSize >= 400) {
      await batch.commit();
      batchSize = 0;
    }
  };

  for (const rawThread of rawThreads) {
    try {
      const threadDetails = await fetchThreadDetails(activeConfig, rawThread.id);
      if (!threadDetails || !threadDetails.messages) continue;

      const messages = threadDetails.messages;
      if (messages.length === 0) continue;

      // Extract thread level info
      const lastMessage = messages[messages.length - 1];
      const internalDate = parseInt(lastMessage.internalDate, 10);
      const lastMessageAt = new Date(internalDate).toISOString();

      const threadDocRef = adminDb
        .collection(COLLECTIONS.GMAIL_THREADS)
        .doc(`${integrationId}_${rawThread.id}`);

      const threadData: GmailThread = {
        id: `${integrationId}_${rawThread.id}`,
        user_id: userId,
        integration_id: integrationId,
        external_id: rawThread.id,
        last_message_at: lastMessageAt,
        message_count: messages.length,
        snippet: threadDetails.snippet || rawThread.snippet,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      batch.set(threadDocRef, threadData, { merge: true });
      batchSize++;
      syncedThreadsCount++;

      // Process messages
      for (const msg of messages) {
        const msgDate = new Date(parseInt(msg.internalDate, 10)).toISOString();
        const headers = msg.payload?.headers || [];
        
        const subject = getHeader(headers, "Subject");
        const from = getHeader(headers, "From");
        const toStr = getHeader(headers, "To");
        const to = toStr ? toStr.split(",").map(s => s.trim()) : [];
        
        const bodyText = extractTextBody(msg.payload);

        const msgDocRef = adminDb
          .collection(COLLECTIONS.GMAIL_MESSAGES)
          .doc(`${integrationId}_${msg.id}`);

        // Only create if it doesn't exist to preserve classification data
        const msgSnap = await msgDocRef.get();
        if (!msgSnap.exists) {
            const messageData: GmailMessage = {
                id: `${integrationId}_${msg.id}`,
                user_id: userId,
                integration_id: integrationId,
                external_id: msg.id,
                thread_id: rawThread.id,
                from,
                to,
                subject,
                snippet: msg.snippet,
                body_text: bodyText,
                received_at: msgDate,
                
                // Classification fields (to be filled by AI pipeline)
                category: null,
                intent_signals: [],
                sentiment: null,
                
                // Attribution fields
                order_id: null,
                customer_id: null,
                
                processed_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
      
              batch.set(msgDocRef, messageData);
              batchSize++;
              syncedMessagesCount++;
        }
      }

      await commitBatchIfNeeded();

    } catch (err) {
      console.error(`Failed to process Gmail thread ${rawThread.id}:`, err);
    }
  }

  if (batchSize > 0) {
    await batch.commit();
  }

  // Update integration sync status
  await integrationRef.update({
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return {
    threads: syncedThreadsCount,
    messages: syncedMessagesCount,
  };
}
