import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyService, SocietyError } from "@/lib/societies/service";
import { VerifyContributionSchema } from "@/lib/societies/validation";
import { requireFounder } from "@/lib/societies/permissions";

/**
 * PATCH /api/societies/:societyId/contributions/:contributionId
 * Verify contribution (founder only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ societyId: string; contributionId: string }> }
) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { societyId, contributionId } = await params;

    // Check founder access
    await requireFounder(societyId, data.user.uid);

    const body = await request.json();

    // Validate input
    const validatedData = VerifyContributionSchema.parse(body);

    // Verify (or reject) contribution
    const verified = validatedData.status === "verified";
    await societyService.verifyContribution(societyId, contributionId, verified);

    return NextResponse.json({
      success: true,
      message: verified ? "Contribution verified" : "Contribution completed",
    });
  } catch (error: any) {
    console.error(
      "PATCH /api/societies/:societyId/contributions/:contributionId error:",
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
