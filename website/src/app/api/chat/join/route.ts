import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import admin, { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function POST(request: NextRequest) {
  try {
    const { inviteCode } = await request.json();
    const { data: authData, error } = await getUserFromRequest(request);

    if (error || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!inviteCode || typeof inviteCode !== "string") {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 400 });
    }

    // Find the chat by invite code
    const chatSnap = await adminDb
      .collection(COLLECTIONS.CHATS)
      .where("invite_code", "==", inviteCode)
      .get();
      
    if (chatSnap.empty) {
      return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 404 });
    }
    
    const chatDoc = chatSnap.docs[0];
    const chatData = chatDoc.data();
    
    // Check if the user is already a participant or owner
    const isOwner = chatData.user_id === authData.user.id;
    const isParticipant = Array.isArray(chatData.participant_ids) && chatData.participant_ids.includes(authData.user.id);
    
    if (isOwner || isParticipant) {
      // User is already in the chat, just return success
      return NextResponse.json({ success: true, chatId: chatDoc.id });
    }
    
    // Add the user to participant_ids using FieldValue.arrayUnion
    const FieldValue = admin.firestore.FieldValue;
    
    await chatDoc.ref.update({
      participant_ids: FieldValue.arrayUnion(authData.user.id),
      updated_at: new Date().toISOString()
    });

    return NextResponse.json({ success: true, chatId: chatDoc.id });

  } catch (err) {
    console.error("Error joining chat:", err);
    return NextResponse.json({ error: "Failed to join chat" }, { status: 500 });
  }
}
