import { NextRequest, NextResponse } from "next/server";

import { COLLECTIONS } from "@/lib/firebase/schema";
import { safeDocId } from "@/lib/firebase/doc-utils";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { normalizeRearvyDisplayText } from "@/lib/brand-display";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("UserProfileApi");

type ProfileDoc = Record<string, unknown>;

function toProfileResponse(profileId: string, rawProfile: ProfileDoc) {
  return {
    id: profileId,
    full_name: normalizeRearvyDisplayText(rawProfile.full_name),
    username: typeof rawProfile.username === "string" ? rawProfile.username : null,
    avatar_url: typeof rawProfile.avatar_url === "string" ? rawProfile.avatar_url : null,
    email: typeof rawProfile.email === "string" ? rawProfile.email : null,
    bio: typeof rawProfile.bio === "string" ? rawProfile.bio : null,
    working_on: typeof rawProfile.working_on === "string" ? rawProfile.working_on : null,
    skills: Array.isArray(rawProfile.skills)
      ? rawProfile.skills.filter((item): item is string => typeof item === "string")
      : [],
    project_links: Array.isArray(rawProfile.project_links)
      ? rawProfile.project_links.filter((item): item is string => typeof item === "string")
      : [],
    business_name: normalizeRearvyDisplayText(rawProfile.business_name),
    business_type: typeof rawProfile.business_type === "string" ? rawProfile.business_type : null,
    timezone: typeof rawProfile.timezone === "string" ? rawProfile.timezone : "UTC",
    currency: typeof rawProfile.currency === "string" ? rawProfile.currency : "USD",
    plan: typeof rawProfile.plan === "string" ? rawProfile.plan : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;
    const profileDoc = await adminDb.collection(COLLECTIONS.PROFILES).doc(userId).get();

    if (!profileDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const relationshipDoc = await adminDb
      .collection(COLLECTIONS.PROFILE_FOLLOW_REQUESTS)
      .doc(safeDocId(data.user.id, userId))
      .get();

    const relationship = relationshipDoc.exists
      ? (() => {
          const relationshipData = relationshipDoc.data() || {};
          return {
            follow_request_status:
              typeof relationshipData.status === "string" ? relationshipData.status : "pending",
            requested_at:
              typeof relationshipData.created_at === "string" ? relationshipData.created_at : null,
          };
        })()
      : {
          follow_request_status: "none",
          requested_at: null,
        };

    return NextResponse.json({
      profile: toProfileResponse(profileDoc.id, profileDoc.data() || {}),
      relationship,
    });
  } catch (error) {
    log.error("GET /api/users/:userId error:", error);
    return NextResponse.json({ error: "Failed to load user profile" }, { status: 500 });
  }
}
