import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  getAdminSessionEmail,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
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

    const societyId = `society_${nanoid(12)}`;
    const now = Timestamp.now();
    const status = validatedData.status || "active";
    const stage = validatedData.stage || "building";

    const societyData = {
      id: societyId,
      name: validatedData.name,
      description: validatedData.description || null,
      category: validatedData.category,
      status,
      stage,
      founder_id: adminUser.uid,
      created_at: now,
      updated_at: now,
      member_count: 1,
      total_revenue: 0,
      total_ownership: 100,
    };

    const founderMemberId = `${societyId}_${adminUser.uid}`;
    const founderMemberData = {
      id: founderMemberId,
      society_id: societyId,
      user_id: adminUser.uid,
      status: "active",
      role: "founder",
      ownership_percent: 100,
      equity_vesting: {
        cliff_months: 0,
        vesting_months: 0,
        vested_percent: 100,
        vesting_start_date: now,
      },
      contribution_score: 0,
      join_date: now,
      updated_at: now,
    };

    const rearvyChat = {
      id: `chat_${societyId}_general`,
      society_id: societyId,
      chat_type: "system_general",
      name: "Rearvy Chat",
      description: "Platform updates, notifications, and general execution context",
      is_pinned: true,
      participant_ids: [adminUser.uid],
      created_by: adminUser.uid,
      created_at: now,
      updated_at: now,
      last_message_at: now,
    };

    const rearvyImportantChat = {
      id: `chat_${societyId}_important`,
      society_id: societyId,
      chat_type: "system_important",
      name: "Rearvy Important",
      description: "Critical assignments, project instructions, and expectations",
      is_pinned: true,
      participant_ids: [adminUser.uid],
      created_by: adminUser.uid,
      created_at: now,
      updated_at: now,
      last_message_at: now,
    };

    const batch = adminDb.batch();
    batch.set(adminDb.collection(COLLECTIONS.SOCIETIES).doc(societyId), societyData);
    batch.set(
      adminDb.collection(COLLECTIONS.SOCIETY_MEMBERS).doc(founderMemberId),
      founderMemberData
    );
    batch.set(
      adminDb.collection(COLLECTIONS.SOCIETY_CHATS).doc(rearvyChat.id),
      rearvyChat
    );
    batch.set(
      adminDb.collection(COLLECTIONS.SOCIETY_CHATS).doc(rearvyImportantChat.id),
      rearvyImportantChat
    );
    await batch.commit();

    const result = { id: societyId, name: validatedData.name };

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

    return NextResponse.json(
      { error: "Failed to create business" },
      { status: 500 }
    );
  }
}
