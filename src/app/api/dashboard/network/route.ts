import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { COLLECTIONS } from "@/lib/firebase/schema";

type ProfilePreview = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type AcceptedConnection = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  accepted_at: string | null;
};

function normalizeProfile(id: string, raw: Record<string, unknown>): ProfilePreview {
  return {
    id,
    full_name: typeof raw.full_name === "string" ? raw.full_name : null,
    username: typeof raw.username === "string" ? raw.username : null,
    avatar_url: typeof raw.avatar_url === "string" ? raw.avatar_url : null,
  };
}

function normalizeAcceptedAt(value: unknown) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && "toDate" in value) {
    const firestoreTimestamp = value as { toDate: () => Date };
    return firestoreTimestamp.toDate().toISOString();
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = data.user.id;
    const collection = adminDb.collection(COLLECTIONS.PROFILE_FOLLOW_REQUESTS);

    const [outgoingAccepted, incomingAccepted] = await Promise.all([
      collection.where("requester_id", "==", userId).where("status", "==", "accepted").get(),
      collection.where("target_user_id", "==", userId).where("status", "==", "accepted").get(),
    ]);

    const connectionMap = new Map<string, { accepted_at: string | null }>();

    const collectConnection = (docData: Record<string, unknown>, isOutgoing: boolean) => {
      const otherUserId = isOutgoing ? docData.target_user_id : docData.requester_id;
      if (typeof otherUserId !== "string" || !otherUserId) {
        return;
      }

      const acceptedAt =
        normalizeAcceptedAt(docData.updated_at) ||
        normalizeAcceptedAt(docData.created_at);

      const existing = connectionMap.get(otherUserId);
      if (!existing) {
        connectionMap.set(otherUserId, { accepted_at: acceptedAt });
        return;
      }

      if (acceptedAt && (!existing.accepted_at || acceptedAt > existing.accepted_at)) {
        connectionMap.set(otherUserId, { accepted_at: acceptedAt });
      }
    };

    outgoingAccepted.docs.forEach((doc) => {
      collectConnection((doc.data() as Record<string, unknown>) || {}, true);
    });

    incomingAccepted.docs.forEach((doc) => {
      collectConnection((doc.data() as Record<string, unknown>) || {}, false);
    });

    const connectionIds = Array.from(connectionMap.keys());
    if (connectionIds.length === 0) {
      return NextResponse.json({ network: [] as AcceptedConnection[] });
    }

    const profileDocs = await Promise.all(
      connectionIds.map((id) => adminDb.collection(COLLECTIONS.PROFILES).doc(id).get())
    );

    const network = profileDocs
      .map((profileDoc) => {
        if (!profileDoc.exists) {
          return null;
        }

        const normalizedProfile = normalizeProfile(
          profileDoc.id,
          (profileDoc.data() as Record<string, unknown>) || {}
        );

        const acceptedMeta = connectionMap.get(profileDoc.id);

        return {
          ...normalizedProfile,
          accepted_at: acceptedMeta?.accepted_at || null,
        };
      })
      .filter((connection): connection is AcceptedConnection => connection !== null)
      .sort((a, b) => {
        if (!a.accepted_at) return 1;
        if (!b.accepted_at) return -1;
        return b.accepted_at.localeCompare(a.accepted_at);
      });

    return NextResponse.json({ network });
  } catch (error) {
    console.error("GET /api/dashboard/network error:", error);
    return NextResponse.json({ error: "Failed to load network" }, { status: 500 });
  }
}
