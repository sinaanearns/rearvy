import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import admin, { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function POST(request: NextRequest) {
  try {
    const { data: authData, error } = await getUserFromRequest(request);

    if (error || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode) {
      return NextResponse.json(
        { error: "Invite code is required" },
        { status: 400 }
      );
    }

    // Find the project with this invite code
    const projectsSnap = await adminDb
      .collection(COLLECTIONS.PROJECTS)
      .where("invite_code", "==", inviteCode)
      .limit(1)
      .get();

    if (projectsSnap.empty) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 404 }
      );
    }

    const projectDoc = projectsSnap.docs[0];
    const projectData = projectDoc.data();

    // Check if user is already a participant
    if (
      projectData.participant_ids?.includes(authData.user.id) ||
      projectData.user_id === authData.user.id
    ) {
      return NextResponse.json({
        projectId: projectDoc.id,
        alreadyJoined: true,
      });
    }

    // Add user to participants
    await projectDoc.ref.update({
      participant_ids: admin.firestore.FieldValue.arrayUnion(authData.user.id),
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({ projectId: projectDoc.id, joined: true });
  } catch (error) {
    console.error("Error joining project:", error);
    return NextResponse.json(
      { error: "Failed to join project" },
      { status: 500 }
    );
  }
}
