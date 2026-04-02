import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyService, SocietyError } from "@/lib/societies/service";
import {
  LogContributionSchema,
  VerifyContributionSchema,
} from "@/lib/societies/validation";
import { isActiveMember, requirePermission } from "@/lib/societies/permissions";
import { from } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";

/**
 * GET /api/societies/:societyId/contributions
 * List contributions with filters
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

    // Get query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const contributorId = url.searchParams.get("contributor_id");

    // Build query
    let query = from(COLLECTIONS.SOCIETY_CONTRIBUTIONS).eq(
      "society_id",
      societyId
    );

    if (status) {
      query = query.eq("status", status);
    }

    if (contributorId) {
      query = query.eq("contributor_id", contributorId);
    }

    const contributions = await query.execute();

    return NextResponse.json({
      contributions: contributions.sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      ),
    });
  } catch (error: any) {
    console.error(
      "GET /api/societies/:societyId/contributions error:",
      error
    );

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
 * POST /api/societies/:societyId/contributions
 * Log contribution
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

    // Check permission
    await requirePermission(societyId, data.user.uid, "log_contributions");

    const body = await request.json();

    // Validate input
    const validatedData = LogContributionSchema.parse(body);

    // Log contribution
    const result = await societyService.logContribution(
      societyId,
      data.user.uid,
      validatedData
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error(
      "POST /api/societies/:societyId/contributions error:",
      error
    );

    if (error.message.includes("Permission denied")) {
      return NextResponse.json(
        { error: "You cannot log contributions in this society" },
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
