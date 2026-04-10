import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getUserFromRequest } from "@/lib/firebase/server";

const JoinRequestSchema = z.object({
  message: z.string().min(20, "Please share a little more detail").max(1000),
});

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
    const validated = JoinRequestSchema.parse(body);
    const societyDoc = await adminDb.collection(COLLECTIONS.SOCIETIES).doc(societyId).get();
    if (!societyDoc.exists) {
      return NextResponse.json({ error: "Society not found" }, { status: 404 });
    }

    const society = societyDoc.data();
    const requestId = adminDb.collection(COLLECTIONS.SOCIETY_JOIN_REQUESTS).doc().id;

    await adminDb.collection(COLLECTIONS.SOCIETY_JOIN_REQUESTS).doc(requestId).set({
      id: requestId,
      society_id: societyId,
      society_name: (society?.name as string) || "Rearvy project",
      user_id: data.user.uid,
      user_email: data.user.email || null,
      user_name: data.user.email || "Rearvy member",
      message: validated.message,
      status: "submitted",
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your interest has been sent to the admin for review.",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    console.error("POST /api/societies/:societyId/join-request error:", error);
    return NextResponse.json(
      { error: "Failed to send join request" },
      { status: 500 }
    );
  }
}