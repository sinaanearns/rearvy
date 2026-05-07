import "server-only";

import { getConfiguredAdminEmails } from "@/lib/admin-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export const USER_DM_CHAT_SCOPE = "user_dm";
export const ADMIN_DM_CHAT_SCOPE = "admin_dm";
export const ADMIN_DM_DISPLAY_TITLE = "Rearvy Admin";

type DirectChatLike = {
  chat_scope?: unknown;
  user_facing_title?: unknown;
};

type AdminProfileDoc = {
  email?: unknown;
  is_admin?: unknown;
  isAdmin?: unknown;
  role?: unknown;
};

function toTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function claimsMarkAdmin(claims: Record<string, unknown> | undefined) {
  return (
    claims?.admin === true ||
    claims?.isAdmin === true ||
    claims?.role === "admin"
  );
}

function profileMarksAdmin(profile: AdminProfileDoc | undefined) {
  return (
    profile?.is_admin === true ||
    profile?.isAdmin === true ||
    profile?.role === "admin"
  );
}

export function getDirectChatId(userIdA: string, userIdB: string) {
  return `dm_${[userIdA, userIdB].sort().join("_")}`;
}

export function isAdminDirectChat(chat: DirectChatLike | null | undefined) {
  return chat?.chat_scope === ADMIN_DM_CHAT_SCOPE;
}

export function getDirectChatUserFacingTitle(chat: DirectChatLike | null | undefined) {
  const explicitTitle = toTrimmedString(chat?.user_facing_title);
  if (explicitTitle) {
    return explicitTitle;
  }

  return isAdminDirectChat(chat) ? ADMIN_DM_DISPLAY_TITLE : null;
}

export function buildUserDirectChatPayload(params: {
  ownerUserId: string;
  participantIds: string[];
  title: string | null;
  createdAt: string;
}) {
  return {
    user_id: params.ownerUserId,
    participant_ids: [...params.participantIds].sort(),
    project_id: null,
    title: params.title,
    is_group: false,
    is_pinned: false,
    is_archived: false,
    chat_type: "direct",
    chat_scope: USER_DM_CHAT_SCOPE,
    created_at: params.createdAt,
    updated_at: params.createdAt,
  };
}

export function buildAdminDirectChatPayload(params: {
  adminUid: string;
  targetUid: string;
  title: string | null;
  createdAt: string;
}) {
  return {
    user_id: params.adminUid,
    participant_ids: [params.adminUid, params.targetUid].sort(),
    project_id: null,
    title: params.title,
    is_group: false,
    is_pinned: false,
    is_archived: false,
    chat_type: "direct",
    chat_scope: ADMIN_DM_CHAT_SCOPE,
    user_facing_title: ADMIN_DM_DISPLAY_TITLE,
    admin_participant_ids: [params.adminUid],
    created_at: params.createdAt,
    updated_at: params.createdAt,
  };
}

export async function resolveAdminUserIds(userIds: string[]) {
  const uniqueIds = Array.from(
    new Set(
      userIds
        .map((userId) => userId.trim())
        .filter((userId) => userId.length > 0)
    )
  );

  const adminIds = new Set<string>();
  if (uniqueIds.length === 0) {
    return adminIds;
  }

  const configuredAdminEmails = new Set(
    getConfiguredAdminEmails().map((email) => email.trim().toLowerCase())
  );

  const authUsers = await Promise.all(
    uniqueIds.map(async (userId) => {
      try {
        const user = await adminAuth.getUser(userId);
        return { userId, user };
      } catch {
        return { userId, user: null };
      }
    })
  );

  const unresolvedIds: string[] = [];

  authUsers.forEach(({ userId, user }) => {
    if (!user) {
      unresolvedIds.push(userId);
      return;
    }

    const email = toTrimmedString(user.email)?.toLowerCase() || "";
    if ((email && configuredAdminEmails.has(email)) || claimsMarkAdmin(user.customClaims || {})) {
      adminIds.add(userId);
      return;
    }

    unresolvedIds.push(userId);
  });

  if (unresolvedIds.length === 0) {
    return adminIds;
  }

  const profileSnapshots = await Promise.all(
    unresolvedIds.map(async (userId) => {
      try {
        return await adminDb.collection(COLLECTIONS.PROFILES).doc(userId).get();
      } catch {
        return null;
      }
    })
  );

  profileSnapshots.forEach((snapshot, index) => {
    if (!snapshot?.exists) {
      return;
    }

    const profile = snapshot.data() as AdminProfileDoc | undefined;
    const email = toTrimmedString(profile?.email)?.toLowerCase() || "";
    if ((email && configuredAdminEmails.has(email)) || profileMarksAdmin(profile)) {
      adminIds.add(unresolvedIds[index]);
    }
  });

  return adminIds;
}
