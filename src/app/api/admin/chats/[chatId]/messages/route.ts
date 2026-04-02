import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isAdminAuthenticated, getAdminSessionEmail } from "@/lib/admin-auth";
import { COLLECTIONS } from "@/lib/firebase/schema";

const SendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

async function resolveAdminUid() {
  const adminEmail = await getAdminSessionEmail();
  if (!adminEmail) {
    throw new Error("Admin session missing email");
  }

  const adminUser = await adminAuth.getUserByEmail(adminEmail);
  return adminUser.uid;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { chatId } = await params;
    const adminUid = await resolveAdminUid();

    const chatSnap = await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).get();
    if (!chatSnap.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chatData = chatSnap.data() || {};
    const participantIds = Array.isArray(chatData.participant_ids) ? chatData.participant_ids : [];
    if (!participantIds.includes(adminUid)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const messagesSnapshot = await adminDb
      .collection(COLLECTIONS.MESSAGES)
      .where("chat_id", "==", chatId)
      .orderBy("created_at", "asc")
      .get();

    const messages = messagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("GET /api/admin/chats/:chatId/messages error:", error);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { chatId } = await params;
    const adminUid = await resolveAdminUid();
    const body = await request.json();
    const validated = SendMessageSchema.parse(body);

    const chatSnap = await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).get();
    if (!chatSnap.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chatData = chatSnap.data() || {};
    const participantIds = Array.isArray(chatData.participant_ids) ? chatData.participant_ids : [];
    if (!participantIds.includes(adminUid)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const messageId = `msg_${nanoid(12)}`;
    const now = Timestamp.now();

    const messageData = {
      id: messageId,
      chat_id: chatId,
      sender_id: adminUid,
      content: validated.content,
      role: "user",
      parts: null,
      tool_invocations: null,
      metadata: {},
      created_at: now,
    };

    await adminDb.collection(COLLECTIONS.MESSAGES).doc(messageId).set(messageData);

    await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).set(
      {
        updated_at: now,
      },
      { merge: true }
    );

    return NextResponse.json({ id: messageId }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/chats/:chatId/messages error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
