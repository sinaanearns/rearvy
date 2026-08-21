import { NextRequest, NextResponse } from "next/server";

import { COLLECTIONS } from "@/lib/firebase/schema";
import { adminDb } from "@/lib/firebase/admin";
import { safeDocId } from "@/lib/firebase/doc-utils";
import { getUserFromRequest } from "@/lib/firebase/server";
import { getFollowRequestProfileMetadata } from "@/lib/follow-requests";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("UserFollowRequestApi");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterId = data.user.id;
    const { userId: targetUserId } = await params;

    if (!targetUserId || targetUserId === requesterId) {
      return NextResponse.json({ error: "You cannot follow yourself" }, { status: 400 });
    }

    const targetProfileDoc = await adminDb.collection(COLLECTIONS.PROFILES).doc(targetUserId).get();
    if (!targetProfileDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const requestId = safeDocId(requesterId, targetUserId);
    const requestRef = adminDb.collection(COLLECTIONS.PROFILE_FOLLOW_REQUESTS).doc(requestId);
    const existingRequest = await requestRef.get();
    const now = new Date();

    if (existingRequest.exists) {
      const existingData = existingRequest.data() || {};
      if (existingData.status === "pending") {
        return NextResponse.json({
          success: true,
          requestId,
          status: "pending",
          message: "Follow request already sent",
        });
      }
    }

    const requesterProfileDoc = await adminDb.collection(COLLECTIONS.PROFILES).doc(requesterId).get();
    const requesterProfile = requesterProfileDoc.exists ? (requesterProfileDoc.data() || {}) : {};
    const targetProfile = targetProfileDoc.data() || {};
    const requesterMetadata = getFollowRequestProfileMetadata(requesterProfile);
    const targetMetadata = getFollowRequestProfileMetadata(targetProfile);

    await requestRef.set(
      {
        id: requestId,
        requester_id: requesterId,
        requester_username: requesterMetadata.username,
        requester_name: requesterMetadata.name,
        target_user_id: targetUserId,
        target_username: targetMetadata.username,
        target_name: targetMetadata.name,
        status: "pending",
        created_at: now,
        updated_at: now,
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      requestId,
      status: "pending",
      message: "Follow request sent",
    });
  } catch (error) {
    log.error("POST /api/users/:userId/follow-request error:", error);
    return NextResponse.json({ error: "Failed to send follow request" }, { status: 500 });
  }
}
