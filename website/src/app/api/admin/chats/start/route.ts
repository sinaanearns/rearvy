import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isAdminAuthenticated, getAdminSessionEmail } from "@/lib/admin-auth";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  ADMIN_DM_CHAT_SCOPE,
  ADMIN_DM_DISPLAY_TITLE,
  buildAdminDirectChatPayload,
  getDirectChatId,
} from "@/lib/chat/direct-messages";

const StartChatSchema = z.object({
  userId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  username: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminEmail = await getAdminSessionEmail();
    if (!adminEmail) {
      return NextResponse.json({ error: "Admin session missing email" }, { status: 401 });
    }

    const body = await request.json();
    const validated = StartChatSchema.parse(body);
    const adminUser = await adminAuth.getUserByEmail(adminEmail);

    let targetUid = validated.userId || null;

    if (!targetUid && validated.email) {
      const targetByEmail = await adminAuth.getUserByEmail(validated.email);
      targetUid = targetByEmail.uid;
    }

    if (!targetUid && validated.username) {
      const usernameLower = validated.username.trim().replace(/^@+/, "").toLowerCase();
      const profileSnap = await adminDb
        .collection(COLLECTIONS.PROFILES)
        .where("username_lower", "==", usernameLower)
        .limit(1)
        .get();

      if (!profileSnap.empty) {
        targetUid = profileSnap.docs[0].id;
      }
    }

    if (!targetUid) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUid === adminUser.uid) {
      return NextResponse.json({ error: "Cannot message yourself" }, { status: 400 });
    }

    const targetUser = await adminAuth.getUser(targetUid);
    const chatId = getDirectChatId(adminUser.uid, targetUid);
    const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(chatId);
    const chatSnap = await chatRef.get();
    const nowIso = new Date().toISOString();
    const directChatPayload = buildAdminDirectChatPayload({
      adminUid: adminUser.uid,
      targetUid,
      title: targetUser.displayName || targetUser.email || `@${targetUid}`,
      createdAt: nowIso,
    });

    if (!chatSnap.exists) {
      await chatRef.set(directChatPayload);
    } else {
      await chatRef.set(
        {
          user_id: adminUser.uid,
          participant_ids: directChatPayload.participant_ids,
          project_id: null,
          title: directChatPayload.title,
          is_group: false,
          is_pinned: false,
          is_archived: false,
          chat_type: "direct",
          chat_scope: ADMIN_DM_CHAT_SCOPE,
          user_facing_title: ADMIN_DM_DISPLAY_TITLE,
          admin_participant_ids: [adminUser.uid],
          updated_at: nowIso,
        },
        { merge: true }
      );
    }

    return NextResponse.json({
      chatId,
      target: {
        id: targetUser.uid,
        email: targetUser.email || null,
        displayName: targetUser.displayName || null,
      },
    });
  } catch (error) {
    console.error("POST /api/admin/chats/start error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to start chat" },
      { status: 500 }
    );
  }
}
