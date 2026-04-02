import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { getAdminSessionEmail, isAdminAuthenticated } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

const DecisionSchema = z.object({
  action: z.enum(["approve", "decline"]),
  note: z.string().max(500).optional(),
});

const PENDING_STATUSES = new Set(["submitted", "reviewing"]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminEmail = await getAdminSessionEmail();
    const { requestId } = await params;
    const body = await request.json();
    const validated = DecisionSchema.parse(body);

    const requestRef = adminDb
      .collection(COLLECTIONS.SOCIETY_JOIN_REQUESTS)
      .doc(requestId);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return NextResponse.json({ error: "Join request not found" }, { status: 404 });
    }

    const requestData = requestDoc.data() || {};
    const currentStatus = String(requestData.status || "submitted");

    if (!PENDING_STATUSES.has(currentStatus)) {
      return NextResponse.json(
        { error: `Join request already ${currentStatus}` },
        { status: 409 }
      );
    }

    const now = new Date();
    const decisionNote = validated.note?.trim() || null;

    if (validated.action === "decline") {
      await requestRef.set(
        {
          status: "rejected",
          decision_note: decisionNote,
          reviewed_by: adminEmail,
          reviewed_at: now,
          updated_at: now,
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        requestId,
        status: "rejected",
        message: "Join request declined",
      });
    }

    const societyId = String(requestData.society_id || "").trim();
    const userId = String(requestData.user_id || "").trim();

    if (!societyId || !userId) {
      return NextResponse.json(
        { error: "Join request is missing society or user data" },
        { status: 400 }
      );
    }

    const societyRef = adminDb.collection(COLLECTIONS.SOCIETIES).doc(societyId);
    const societyDoc = await societyRef.get();
    if (!societyDoc.exists) {
      return NextResponse.json({ error: "Society not found" }, { status: 404 });
    }

    const existingMemberSnap = await adminDb
      .collection(COLLECTIONS.SOCIETY_MEMBERS)
      .where("society_id", "==", societyId)
      .where("user_id", "==", userId)
      .limit(1)
      .get();

    const societyChatsSnapshot = await adminDb
      .collection(COLLECTIONS.SOCIETY_CHATS)
      .where("society_id", "==", societyId)
      .get();

    const batch = adminDb.batch();

    let memberCountShouldIncrement = false;
    const memberRef = existingMemberSnap.empty
      ? adminDb.collection(COLLECTIONS.SOCIETY_MEMBERS).doc(`${societyId}_${userId}`)
      : existingMemberSnap.docs[0].ref;

    if (existingMemberSnap.empty) {
      memberCountShouldIncrement = true;
      batch.set(memberRef, {
        id: memberRef.id,
        society_id: societyId,
        user_id: userId,
        status: "active",
        role: "member",
        ownership_percent: 0,
        contribution_score: 0,
        join_date: now,
        updated_at: now,
      });
    } else {
      const memberData = existingMemberSnap.docs[0].data();
      const previousStatus = String(memberData.status || "inactive");
      memberCountShouldIncrement = previousStatus === "removed" || previousStatus === "inactive";

      batch.set(
        memberRef,
        {
          status: "active",
          updated_at: now,
          join_date: memberData.join_date || now,
        },
        { merge: true }
      );
    }

    if (memberCountShouldIncrement) {
      batch.set(
        societyRef,
        {
          member_count: FieldValue.increment(1),
          updated_at: now,
        },
        { merge: true }
      );
    }

    batch.set(
      requestRef,
      {
        status: "approved",
        decision_note: decisionNote,
        reviewed_by: adminEmail,
        reviewed_at: now,
        updated_at: now,
        approved_member_id: memberRef.id,
      },
      { merge: true }
    );

    let assignedChatCount = 0;
    societyChatsSnapshot.docs.forEach((chatDoc) => {
      const chatData = chatDoc.data() as {
        chat_type?: string;
        is_group?: boolean;
        participant_ids?: string[];
      };

      const chatType = String(chatData.chat_type || "");
      const isGroupChat = chatData.is_group === true || chatType.startsWith("system_");
      if (!isGroupChat || chatType === "direct") {
        return;
      }

      assignedChatCount += 1;
      batch.set(
        chatDoc.ref,
        {
          participant_ids: FieldValue.arrayUnion(userId),
          updated_at: now,
        },
        { merge: true }
      );
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      requestId,
      status: "approved",
      memberId: memberRef.id,
      assignedChats: assignedChatCount,
      message: "Join request approved",
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    console.error("PATCH /api/admin/societies/join-requests/:requestId error:", error);
    return NextResponse.json(
      { error: "Failed to process join request" },
      { status: 500 }
    );
  }
}
