import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyService, SocietyError } from "@/lib/societies/service";
import { UpdateSocietySchema } from "@/lib/societies/validation";
import { isActiveMember, requireFounder } from "@/lib/societies/permissions";

function isPublicSociety(status: unknown) {
  if (typeof status !== "string") {
    return false;
  }

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
    const { data, error } = await getUserFromRequest(request);

    if (error || !data.user) {
      if (!isPublicSociety(society.status)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      return NextResponse.json({
        ...toPublicSociety(society),
        viewer_is_member: false,
        access_level: "public",
      });
    }

    // Check if user is member
    const isMember = await isActiveMember(societyId, data.user.uid);
    if (!isMember) {
      if (!isPublicSociety(society.status)) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }

      return NextResponse.json({
        ...toPublicSociety(society),
        viewer_is_member: false,
        access_level: "public",
      });
    }

    return NextResponse.json({
      ...society,
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
