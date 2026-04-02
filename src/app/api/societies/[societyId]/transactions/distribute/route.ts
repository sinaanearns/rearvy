import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyService, SocietyError } from "@/lib/societies/service";
import { DistributeRevenueSchema } from "@/lib/societies/validation";
import { requireFounder } from "@/lib/societies/permissions";

/**
 * POST /api/societies/:societyId/transactions/distribute
 * Distribute revenue to members based on ownership %
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
    const validatedData = DistributeRevenueSchema.parse(body);

    // Distribute revenue
    const result = await societyService.distributeRevenue(
      societyId,
      validatedData
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error(
      "POST /api/societies/:societyId/transactions/distribute error:",
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
