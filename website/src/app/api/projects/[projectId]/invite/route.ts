import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("ProjectInviteApi");

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const { data: authData, error } = await getUserFromRequest(request);

    if (error || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectRef = adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectData = projectSnap.data();

    if (projectData?.user_id !== authData.user.id) {
      return NextResponse.json(
        { error: "Only the project owner can generate an invite link" },
        { status: 403 }
      );
    }

    // Return existing invite code if already generated
    if (projectData?.invite_code) {
      return NextResponse.json({ inviteCode: projectData.invite_code });
    }

    // Generate a new invite code
    const inviteCode = crypto.randomUUID().replace(/-/g, "");

    await projectRef.update({
      invite_code: inviteCode,
      participant_ids: projectData.participant_ids || [authData.user.id],
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ inviteCode });
  } catch (error) {
    log.error("Error generating project invite link:", error);
    return NextResponse.json(
      { error: "Failed to generate invite link" },
      { status: 500 }
    );
  }
}
