import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getUserFromRequest } from "@/lib/firebase/server";

const SubmitSocietyIdeaSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(500),
  category: z.enum(["tech", "ecommerce", "saas", "content", "other"]),
});

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = SubmitSocietyIdeaSchema.parse(body);

    const ideaRef = adminDb.collection(COLLECTIONS.SOCIETY_IDEAS).doc();

    await ideaRef.set({
      id: ideaRef.id,
      user_id: data.user.id,
      user_email: data.user.email,
      name: validated.name,
      description: validated.description,
      category: validated.category,
      status: "submitted",
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        id: ideaRef.id,
        message: "Idea submitted successfully. Admin will review it.",
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

    console.error("POST /api/society-ideas error:", error);
    return NextResponse.json(
      { error: "Failed to submit idea" },
      { status: 500 }
    );
  }
}
