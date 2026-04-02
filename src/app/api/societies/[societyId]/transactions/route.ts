import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { societyService, SocietyError } from "@/lib/societies/service";
import { LogTransactionSchema, DistributeRevenueSchema } from "@/lib/societies/validation";
import { requireFounder } from "@/lib/societies/permissions";
import { from } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";

/**
 * GET /api/societies/:societyId/transactions
 * Audit log of all transactions
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

    // Check founder access (only founder can view detailed transactions)
    // In a real app, you might show redacted data to members
    await requireFounder(societyId, data.user.uid);

    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Get transactions
    const transactions = await from(COLLECTIONS.SOCIETY_TRANSACTIONS)
      .eq("society_id", societyId)
      .order("created_at", { ascending: false })
      .execute();

    const paginated = transactions.slice(offset, offset + limit);

    return NextResponse.json({
      transactions: paginated,
      total: transactions.length,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error(
      "GET /api/societies/:societyId/transactions error:",
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

/**
 * POST /api/societies/:societyId/transactions
 * Log transaction (founder only)
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
    const validatedData = LogTransactionSchema.parse(body);

    // Log transaction
    const transactionId = `txn_${Date.now()}`;
    const { insertDoc } = await import("@/lib/firebase/firestore");

    const { error: insertError } = await insertDoc(
      COLLECTIONS.SOCIETY_TRANSACTIONS,
      {
        id: transactionId,
        society_id: societyId,
        ...validatedData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      transactionId
    );

    if (insertError) {
      throw new SocietyError(
        "TRANSACTION_FAILED",
        `Failed to log transaction: ${insertError.message}`
      );
    }

    return NextResponse.json({ id: transactionId }, { status: 201 });
  } catch (error: any) {
    console.error(
      "POST /api/societies/:societyId/transactions error:",
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
