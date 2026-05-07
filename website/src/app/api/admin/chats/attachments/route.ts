import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getAdminSessionEmail, isAdminAuthenticated } from "@/lib/admin-auth";
import { uploadChatAttachment } from "@/lib/chat/attachment-storage";

type ChatDoc = {
  participant_ids?: string[];
};

async function resolveAdminUid() {
  const adminEmail = await getAdminSessionEmail();
  if (!adminEmail) {
    throw new Error("Admin session missing email");
  }

  const adminUser = await adminAuth.getUserByEmail(adminEmail);
  return adminUser.uid;
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminUid = await resolveAdminUid();
    const formData = await request.formData();
    const chatId = typeof formData.get("chatId") === "string" ? String(formData.get("chatId")) : "";
    const fileEntry = formData.get("file");

    if (!chatId.trim()) {
      return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Attachment file is required" }, { status: 400 });
    }

    const chatDoc = await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).get();
    if (!chatDoc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chat = chatDoc.data() as ChatDoc | undefined;
    const participantIds = Array.isArray(chat?.participant_ids) ? chat.participant_ids : [];
    if (!participantIds.includes(adminUid)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const attachment = await uploadChatAttachment({
      chatId,
      uploaderId: adminUid,
      fileName: fileEntry.name || "attachment",
      contentType: fileEntry.type || "application/octet-stream",
      size: fileEntry.size,
      buffer: Buffer.from(await fileEntry.arrayBuffer()),
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/chats/attachments error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload attachment",
      },
      { status: 500 }
    );
  }
}
