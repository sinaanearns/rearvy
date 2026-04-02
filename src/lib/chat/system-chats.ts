import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

type SystemChatType = "rearvy_chat" | "rearvy_important";

function buildSystemChatPayload(userId: string, type: SystemChatType) {
  const isImportant = type === "rearvy_important";
  const nowIso = new Date().toISOString();

  return {
    user_id: userId,
    participant_ids: [userId],
    project_id: null,
    title: isImportant ? "Rearvy Important" : "Rearvy Chat",
    is_archived: false,
    is_pinned: true,
    is_group: false,
    parent_chat_id: null,
    fork_point_message_id: null,
    system_chat_type: type,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

/**
 * Ensure every user has the two default system chats required by Rearvy Society.
 */
export async function ensureDefaultUserSystemChats(userId: string): Promise<void> {
  const chatConfigs: Array<{ id: string; type: SystemChatType }> = [
    { id: `system_${userId}_rearvy_chat`, type: "rearvy_chat" },
    { id: `system_${userId}_rearvy_important`, type: "rearvy_important" },
  ];

  const chatRefs = chatConfigs.map(({ id }) =>
    adminDb.collection(COLLECTIONS.CHATS).doc(id)
  );
  const existingSnaps = await Promise.all(chatRefs.map((ref) => ref.get()));

  const creations = existingSnaps
    .map((snap, index) => ({ snap, config: chatConfigs[index], ref: chatRefs[index] }))
    .filter(({ snap }) => !snap.exists)
    .map(({ config, ref }) =>
      ref.set(buildSystemChatPayload(userId, config.type), { merge: true })
    );

  if (creations.length > 0) {
    await Promise.all(creations);
  }
}
