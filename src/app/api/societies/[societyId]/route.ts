import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyService, SocietyError } from "@/lib/societies/service";
import { UpdateSocietySchema } from "@/lib/societies/validation";
import { isActiveMember, requireFounder } from "@/lib/societies/permissions";

type TeamPreviewMember = {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
};

async function getTeamPreview(societyId: string): Promise<TeamPreviewMember[]> {
  const membersSnap = await adminDb
    .collection(COLLECTIONS.SOCIETY_MEMBERS)
    .where("society_id", "==", societyId)
    .where("status", "==", "active")
    .limit(10)
    .get();

  if (membersSnap.empty) {
    return [];
  }

  const baseMembers = membersSnap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      user_id: typeof data.user_id === "string" ? data.user_id : "",
      role: typeof data.role === "string" ? data.role : "member",
    };
  });

  const preview = await Promise.all(
    baseMembers.map(async (member) => {
      if (!member.user_id) {
        return {
          ...member,
          display_name: "Rearvy contributor",
          username: null,
          avatar_url: null,
        };
      }

      const profileSnap = await adminDb
        .collection(COLLECTIONS.PROFILES)
        .doc(member.user_id)
        .get();

      const profile = profileSnap.exists
        ? ((profileSnap.data() as Record<string, unknown>) ?? {})
        : {};

      const fullName =
        typeof profile.full_name === "string" ? profile.full_name.trim() : "";
      const usernameRaw =
        typeof profile.username === "string" ? profile.username.trim() : "";
      const avatarUrl =
        typeof profile.avatar_url === "string" ? profile.avatar_url.trim() : "";

      return {
        ...member,
        display_name: fullName || usernameRaw || "Rearvy contributor",
        username: usernameRaw || null,
        avatar_url: avatarUrl || null,
      };
    })
  );

  return preview;
}

function isPublicSociety(status: string | undefined) {
  return status === "active" || status === "approved";
}

function toPublicSociety(society: Record<string, unknown>) {
  return {
    id: society.id,
    name: society.name,
    description: society.description ?? null,
    category: society.category,
    status: society.status,
    stage: society.stage ?? null,
    member_count: society.member_count ?? 0,
    total_revenue: society.total_revenue ?? 0,
  };
}

/**
 * GET /api/societies/:societyId
 * Get society details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ societyId: string }> }
) {
  try {
    const { societyId } = await params;
    const societyDoc = await adminDb.collection(COLLECTIONS.SOCIETIES).doc(societyId).get();
    if (!societyDoc.exists) {
      return NextResponse.json({ error: "Society not found" }, { status: 404 });
    }

    const society = {
      id: societyDoc.id,
      ...societyDoc.data(),
    } as Record<string, unknown>;
    const societyStatus =
      typeof society.status === "string" ? society.status : undefined;
    const teamPreview = await getTeamPreview(societyId);
    const { data, error } = await getUserFromRequest(request);

    if (error || !data.user) {
      if (!isPublicSociety(societyStatus)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      return NextResponse.json({
        ...toPublicSociety(society),
        team_preview: teamPreview,
        viewer_is_member: false,
        access_level: "public",
      });
    }

    // Check if user is member
    const isMember = await isActiveMember(societyId, data.user.uid);
    if (!isMember) {
      if (!isPublicSociety(societyStatus)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      return NextResponse.json({
        ...toPublicSociety(society),
        team_preview: teamPreview,
        viewer_is_member: false,
        access_level: "public",
      });
    }

    return NextResponse.json({
      ...society,
      team_preview: teamPreview,
      viewer_is_member: true,
      access_level: "member",
    });
  } catch (error: unknown) {
    console.error("GET /api/societies/:societyId error:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/societies/:societyId
 * Update society details (founder only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ societyId: string }> }
) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { societyId } = await params;

    // Check founder access
    await requireFounder(societyId, data.user.uid);

    const body = await request.json();

    // Validate input
    const validatedData = UpdateSocietySchema.parse(body);

    // Update society
    await societyService.updateSociety(societyId, validatedData);

    // Return updated society
    const updated = await societyService.getSociety(societyId);
    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("PATCH /api/societies/:societyId error:", error);

    if (error.message.includes("Founder access required")) {
      return NextResponse.json(
        { error: "Founder access required" },
        { status: 403 }
      );
    }

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", issues: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof SocietyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
