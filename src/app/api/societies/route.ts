import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { isAdminUser } from "@/lib/admin-auth";
import { societyService, SocietyError } from "@/lib/societies/service";
import { CreateSocietySchema } from "@/lib/societies/validation";

/**
 * GET /api/societies
 * List all societies user is member/invited to
 */
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membershipsSnapshot = await adminDb
      .collection(COLLECTIONS.SOCIETY_MEMBERS)
      .where("user_id", "==", data.user.uid)
      .get();

    const memberSocietyIds = [...new Set(
      membershipsSnapshot.docs
        .map((doc) => doc.data()?.society_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    )];

    const publishedSocietiesSnapshot = await adminDb
      .collection(COLLECTIONS.SOCIETIES)
      .where("status", "in", ["active", "approved"])
      .limit(30)
      .get();

    const publishedSocietyIds = publishedSocietiesSnapshot.docs.map((doc) => doc.id);
    const societyIds = [...new Set([...memberSocietyIds, ...publishedSocietyIds])];

    if (societyIds.length === 0) {
      return NextResponse.json({ societies: [] });
    }

    const societyDocs = await Promise.all(
      societyIds.map((id) => adminDb.collection(COLLECTIONS.SOCIETIES).doc(id).get())
    );

    const societies = societyDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

    return NextResponse.json({
      societies,
    });
  } catch (error: any) {
    console.error("GET /api/societies error:", error);
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
 * POST /api/societies
 * Create new society
 */
export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canCreateSociety = await isAdminUser(data.user);
    if (!canCreateSociety) {
      return NextResponse.json(
        {
          error:
            "Only admins can create businesses. Submit an idea and an admin will review it.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = CreateSocietySchema.parse(body);

    // Create society
    const result = await societyService.createSociety(data.user.uid, validatedData);

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/societies error:", error);

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
