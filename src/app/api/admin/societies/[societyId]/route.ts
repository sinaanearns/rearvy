import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";

async function deleteCollectionDocsBySocietyId(
  collectionName: string,
  societyId: string
) {
  const snapshot = await adminDb
    .collection(collectionName)
    .where("society_id", "==", societyId)
    .get();

  if (snapshot.empty) {
    return 0;
  }

  let deletedCount = 0;
  for (let index = 0; index < snapshot.docs.length; index += 400) {
    const batch = adminDb.batch();
    const docs = snapshot.docs.slice(index, index + 400);

    docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    deletedCount += docs.length;
  }

  return deletedCount;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ societyId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { societyId } = await params;
    const societyRef = adminDb.collection(COLLECTIONS.SOCIETIES).doc(societyId);
    const societyDoc = await societyRef.get();

    if (!societyDoc.exists) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const collectionsToDelete = [
      COLLECTIONS.SOCIETY_MEMBERS,
      COLLECTIONS.SOCIETY_ROLES,
      COLLECTIONS.SOCIETY_CHATS,
      COLLECTIONS.SOCIETY_MESSAGES,
      COLLECTIONS.SOCIETY_CONTRIBUTIONS,
      COLLECTIONS.SOCIETY_TRANSACTIONS,
      COLLECTIONS.SOCIETY_JOIN_REQUESTS,
    ];

    const deletedCounts: Record<string, number> = {};
    for (const collectionName of collectionsToDelete) {
      deletedCounts[collectionName] = await deleteCollectionDocsBySocietyId(
        collectionName,
        societyId
      );
    }

    await societyRef.delete();

    return NextResponse.json({
      success: true,
      message: "Business deleted successfully.",
      deletedCounts,
    });
  } catch (error) {
    console.error("DELETE /api/admin/societies/:societyId error:", error);
    return NextResponse.json(
      { error: "Failed to delete business" },
      { status: 500 }
    );
  }
}