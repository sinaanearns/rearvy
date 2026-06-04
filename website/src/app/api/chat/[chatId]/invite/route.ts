import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("ChatInviteApi");

interface RouteParams {
  params: Promise<{ chatId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { chatId } = await params;
    const { data: authData, error } = await getUserFromRequest(request);

    if (error || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(chatId);
    const chatSnap = await chatRef.get();

    if (!chatSnap.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chatData = chatSnap.data();

    if (chatData?.user_id !== authData.user.id) {
      return NextResponse.json(
        { error: "Only the chat owner can generate an invite link" },
        { status: 403 }
      );
    }

    // Return existing invite code if already generated
    if (chatData?.invite_code) {
      return NextResponse.json({ inviteCode: chatData.invite_code });
    }

    // Generate a new invite code
    const inviteCode = crypto.randomUUID().replace(/-/g, "");

    await chatRef.update({
      is_group: true,
      invite_code: inviteCode,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ inviteCode });
  } catch (error) {
    log.error("Error generating invite link:", error);
    return NextResponse.json(
      { error: "Failed to generate invite link" },
      { status: 500 }
    );
  }
}
