import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  getAdminSessionEmail,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { societyService, SocietyError } from "@/lib/societies/service";
import { CreateSocietySchema } from "@/lib/societies/validation";

const AdminSocietySchema = CreateSocietySchema.extend({
  status: z.enum(["ideation", "approved", "active", "completed", "archived"]).optional(),
  stage: z.enum(["formation", "building", "scaling", "exiting"]).optional(),
});

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const societiesSnapshot = await adminDb
      .collection(COLLECTIONS.SOCIETIES)
      .orderBy("created_at", "desc")
      .limit(10)
      .get();

    const societies = societiesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ societies });
  } catch (error) {
    console.error("GET /api/admin/societies error:", error);
    return NextResponse.json(
      { error: "Failed to load businesses" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminEmail = await getAdminSessionEmail();
    if (!adminEmail) {
      return NextResponse.json(
        { error: "Admin session missing email. Please sign in again." },
        { status: 401 }
      );
    }

    const adminUser = await adminAuth.getUserByEmail(adminEmail);
    const body = await request.json();
    const validatedData = AdminSocietySchema.parse(body);

    const result = await societyService.createSociety(
      adminUser.uid,
      validatedData,
      {
        status: validatedData.status || "active",
        stage: validatedData.stage || "building",
      }
    );

    return NextResponse.json(
      {
        success: true,
        society: result,
        message: "Rearvy Society business created successfully.",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("POST /api/admin/societies error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "auth/user-not-found"
    ) {
      return NextResponse.json(
        { error: "Admin user not found in Firebase Auth" },
        { status: 404 }
      );
    }

    if (error instanceof SocietyError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to create business" },
      { status: 500 }
    );
  }
}
