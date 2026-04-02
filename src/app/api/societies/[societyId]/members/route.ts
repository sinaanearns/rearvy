import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyService, SocietyError } from "@/lib/societies/service";
import { InviteMemberSchema } from "@/lib/societies/validation";
import { requireFounder, isActiveMember } from "@/lib/societies/permissions";

/**
 * GET /api/societies/:societyId/members
 * List members with roles & ownership
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ societyId: string }> }
) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { societyId } = await params;

    // Check if user is member
    const isMember = await isActiveMember(societyId, data.user.uid);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const members = await societyService.getSocietyMembers(societyId);

    return NextResponse.json({
      members: members.filter((m) => m.status !== "invited"), // Hide uninvited members
    });
  } catch (error: any) {
    console.error("GET /api/societies/:societyId/members error:", error);

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
 * POST /api/societies/:societyId/members
 * Invite user by email
 */
export async function POST(
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
    const validatedData = InviteMemberSchema.parse(body);

    // Invite member
    const result = await societyService.inviteMember(societyId, validatedData);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/societies/:societyId/members error:", error);

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
