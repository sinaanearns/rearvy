import { NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { getAdminSessionEmail, isAdminAuthenticated } from "@/lib/admin-auth";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getDirectChatId } from "@/lib/chat/direct-messages";

type AdminUserRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  username: string | null;
  fullName: string | null;
  existingChatId: string | null;
};

function normalizeProfileString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeUserId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function fetchAllAuthUsers() {
  const users = [] as Awaited<ReturnType<typeof adminAuth.listUsers>>["users"];
  let pageToken: string | undefined;

  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken || undefined;
  } while (pageToken);

  return users;
}

async function fetchSocietyUserIds() {
  return new Set<string>();
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminEmail = await getAdminSessionEmail();
    if (!adminEmail) {
      return NextResponse.json(
        { error: "Admin session missing email" },
        { status: 401 }
      );
    }

    const adminUser = await adminAuth.getUserByEmail(adminEmail);
    const authUsers = await fetchAllAuthUsers();
    const targetUsers = authUsers.filter(
      (user) => user.uid !== adminUser.uid
    );

    if (targetUsers.length === 0) {
      return NextResponse.json({
        users: [],
        adminUid: adminUser.uid,
      });
    }

    const profileDocs = await Promise.all(
      targetUsers.map((user) => adminDb.collection(COLLECTIONS.PROFILES).doc(user.uid).get())
    );

    const profileMap = new Map(
      profileDocs.map((doc) => [
        doc.id,
        doc.exists ? doc.data() || {} : {},
      ])
    );

    const chatIds = targetUsers.map((user) => getDirectChatId(adminUser.uid, user.uid));
    const chatDocs = await Promise.all(
      chatIds.map((chatId) => adminDb.collection(COLLECTIONS.CHATS).doc(chatId).get())
    );

    const users: AdminUserRow[] = targetUsers.map((user, index) => {
      const profile = profileMap.get(user.uid) || {};
      const chatDoc = chatDocs[index];

      return {
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        disabled: Boolean(user.disabled),
        createdAt: user.metadata.creationTime || new Date().toISOString(),
        lastSignInAt: user.metadata.lastSignInTime || null,
        username: normalizeProfileString(profile.username) || normalizeProfileString(profile.username_lower),
        fullName: normalizeProfileString(profile.full_name),
        existingChatId: chatDoc.exists ? chatDoc.id : null,
      };
    });

    return NextResponse.json({
      users,
      adminUid: adminUser.uid,
    });
  } catch (error) {
    console.error("GET /api/admin/chats/users error:", error);
    return NextResponse.json(
      { error: "Failed to load admin chat users" },
      { status: 500 }
    );
  }
}
