import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyService, SocietyError } from "@/lib/societies/service";
import { UpdateMemberOwnershipSchema } from "@/lib/societies/validation";
import { requireFounder, isActiveMember } from "@/lib/societies/permissions";

/**
 * PATCH /api/societies/:societyId/members/:userId
 * Update member ownership (founder only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ societyId: string; userId: string }> }
) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { societyId, userId } = await params;

    // Check founder access
    await requireFounder(societyId, data.user.uid);

    const body = await request.json();

    // Validate input
    const validatedData = UpdateMemberOwnershipSchema.parse(body);

    // Update membership
    const memberId = `${societyId}_${userId}`;
    await societyService.updateMemberOwnership(
      societyId,
      memberId,
      validatedData
    );

    return NextResponse.json({
      success: true,
      message: "Member updated",
    });
  } catch (error: any) {
    console.error(
      "PATCH /api/societies/:societyId/members/:userId error:",
      error
    );

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

/**
 * DELETE /api/societies/:societyId/members/:userId
 * Remove member (founder only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ societyId: string; userId: string }> }
) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { societyId, userId } = await params;

    // Check founder access
    await requireFounder(societyId, data.user.uid);

    // Mark member as removed (soft delete)
    const memberId = `${societyId}_${userId}`;
    await societyService.updateMemberOwnership(societyId, memberId, {
      status: "removed",
    });

    return NextResponse.json({
      success: true,
      message: "Member removed",
    });
  } catch (error: any) {
    console.error(
      "DELETE /api/societies/:societyId/members/:userId error:",
      error
    );

    if (error.message.includes("Founder access required")) {
      return NextResponse.json(
        { error: "Founder access required" },
        { status: 403 }
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
