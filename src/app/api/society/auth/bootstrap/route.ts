import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyAdminDb } from "@/lib/firebase/society/admin";
import { SOCIETY_COLLECTIONS } from "@/lib/firebase/society/schema";

export const runtime = "nodejs";

const DEFAULT_REARVY_CHAT_TITLE = "Rearvy Chat";
const DEFAULT_ELITE_CHAT_TITLE = "Elite Chat";

const DEFAULT_REARVY_CHAT_MESSAGE =
  "Welcome to Rearvy Society. Here is how this works: members who create real impact can receive monthly profit opportunities. Each month, share what you worked on, the challenges you faced, and what you want to achieve next.";

const DEFAULT_ELITE_CHAT_MESSAGE =
  "What are you great at? Do you already have a business idea, are you currently building one, or do you want to learn how we make money together?";

type BootstrapRequestBody = {
  fullName?: unknown;
  avatarUrl?: unknown;
  username?: unknown;
};

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return normalized.replace(/[^a-z0-9_.-]/g, "");
}

async function ensureDefaultChat(
  userId: string,
  title: string,
  seedMessage: string
): Promise<{ chatId: string; created: boolean }> {
  const nowIso = new Date().toISOString();
  const chatsRef = societyAdminDb.collection(SOCIETY_COLLECTIONS.CHATS);

  const existingChatSnapshot = await chatsRef
    .where("user_id", "==", userId)
    .where("title", "==", title)
    .limit(1)
    .get();

  let chatId = "";
  let created = false;

  if (existingChatSnapshot.empty) {
    const newChatRef = await chatsRef.add({
      user_id: userId,
      participant_ids: [userId],
      project_id: null,
      title,
      parent_chat_id: null,
      fork_point_message_id: null,
      is_archived: false,
      is_pinned: true,
      is_group: false,
      created_at: nowIso,
      updated_at: nowIso,
    });

    chatId = newChatRef.id;
    created = true;
  } else {
    chatId = existingChatSnapshot.docs[0].id;
  }

  const messagesRef = societyAdminDb.collection(SOCIETY_COLLECTIONS.MESSAGES);
  const existingMessages = await messagesRef.where("chat_id", "==", chatId).limit(20).get();
  const hasSeedMessage = existingMessages.docs.some((doc) => {
    const data = doc.data() as { metadata?: { seed?: boolean } };
    return data.metadata?.seed === true;
  });

  if (!hasSeedMessage) {
    await messagesRef.add({
      chat_id: chatId,
      role: "assistant",
      content: seedMessage,
      parts: [{ type: "text", text: seedMessage }],
      tool_invocations: null,
      metadata: {
        seed: true,
        chat_type: title,
      },
      created_at: nowIso,
    });
  }

  return { chatId, created };
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as BootstrapRequestBody;

    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim() : "";
    const requestedUsername = normalizeUsername(body.username);

    const profileRef = societyAdminDb
      .collection(SOCIETY_COLLECTIONS.PROFILES)
      .doc(data.user.id);
    const profileSnap = await profileRef.get();
    const existingProfile = (profileSnap.data() || {}) as Record<string, unknown>;

    const emailPrefix = data.user.email?.split("@")[0]?.toLowerCase() || "rearvy_member";
    const fallbackUsername = emailPrefix.replace(/[^a-z0-9_.-]/g, "") || "rearvy_member";

    await profileRef.set(
      {
        id: data.user.id,
        full_name: fullName || existingProfile.full_name || "",
        email: data.user.email || existingProfile.email || "",
        avatar_url: avatarUrl || existingProfile.avatar_url || null,
        username: requestedUsername || existingProfile.username || fallbackUsername,
        onboarding_completed: existingProfile.onboarding_completed || false,
        role: existingProfile.role || "member",
        created_at: existingProfile.created_at || new Date(),
        updated_at: new Date(),
      },
      { merge: true }
    );

    const defaultChats = await Promise.all([
      ensureDefaultChat(data.user.id, DEFAULT_REARVY_CHAT_TITLE, DEFAULT_REARVY_CHAT_MESSAGE),
      ensureDefaultChat(data.user.id, DEFAULT_ELITE_CHAT_TITLE, DEFAULT_ELITE_CHAT_MESSAGE),
    ]);

    return NextResponse.json({
      success: true,
      profile: {
        id: data.user.id,
        username: requestedUsername || existingProfile.username || fallbackUsername,
      },
      chats: defaultChats,
    });
  } catch (error) {
    console.error("Society bootstrap API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to initialize Rearvy Society right now.",
      },
      { status: 400 }
    );
  }
}
