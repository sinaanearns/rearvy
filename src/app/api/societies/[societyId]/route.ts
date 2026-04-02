import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyService, SocietyError } from "@/lib/societies/service";
import { UpdateSocietySchema } from "@/lib/societies/validation";
import { isActiveMember, requireFounder } from "@/lib/societies/permissions";

/**
 * GET /api/societies/:societyId
 * Get society details
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
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const society = await societyService.getSociety(societyId);

    return NextResponse.json(society);
  } catch (error: any) {
    console.error("GET /api/societies/:societyId error:", error);

    if (error instanceof SocietyError) {
      if (error.code === "NOT_FOUND") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
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
