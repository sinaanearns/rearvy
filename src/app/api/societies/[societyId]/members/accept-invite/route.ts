import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyService, SocietyError } from "@/lib/societies/service";
import { z } from "zod";

/**
 * POST /api/societies/:societyId/members/accept-invite
 * Accept society invite
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

    const body = await request.json();

    // Validate input
    const schema = z.object({
      invite_code: z.string().min(1),
    });

    const { invite_code } = schema.parse(body);

    // Accept invite
    await societyService.acceptInvite(societyId, data.user.uid, invite_code);

    return NextResponse.json({
      success: true,
      message: "Invite accepted",
    });
  } catch (error: any) {
    console.error(
      "POST /api/societies/:societyId/members/accept-invite error:",
      error
    );

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
