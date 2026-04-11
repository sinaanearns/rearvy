import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { isLegacySystemChat } from "@/lib/chat/system-chats";

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;

    // Fetch profile
    const profileDoc = await adminDb
      .collection(COLLECTIONS.PROFILES)
      .doc(user.uid)
      .get();
    const profile = profileDoc.data();
    const userName = profile?.full_name || null;

    // Fetch recent chats - sorted in memory if needed
    let recentChats: Array<{ id: string; title: string; updated_at: string }> = [];
    try {
      const chatsSnapshot = await adminDb
        .collection(COLLECTIONS.CHATS)
        .where("user_id", "==", user.uid)
        .orderBy("updated_at", "desc")
        .limit(20)
        .get();

      recentChats = chatsSnapshot.docs
        .filter((doc) => !isLegacySystemChat(doc.data()))
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "Untitled",
            updated_at: data.updated_at || new Date().toISOString(),
          };
        });
    } catch (chatErr) {
      console.warn("Failed to fetch ordered chats, trying without orderBy:", chatErr);
      // Fallback: fetch without orderBy and sort in memory
      const chatsSnapshot = await adminDb
        .collection(COLLECTIONS.CHATS)
        .where("user_id", "==", user.uid)
        .get();

      recentChats = chatsSnapshot.docs
        .filter((doc) => !isLegacySystemChat(doc.data()))
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || "Untitled",
            updated_at: data.updated_at || new Date().toISOString(),
          };
        })
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 20);
    }

    // Fetch projects
    let projects: Array<{ id: string; name: string }> = [];
    try {
      const projectsSnapshot = await adminDb
        .collection(COLLECTIONS.PROJECTS)
        .where("user_id", "==", user.uid)
        .where("is_archived", "==", false)
        .orderBy("created_at", "desc")
        .get();

      projects = projectsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || "Untitled Project",
        };
      });
    } catch (projectErr) {
      console.warn("Failed to fetch ordered projects, trying without orderBy:", projectErr);
      // Fallback: fetch without orderBy and sort in memory
      const projectsSnapshot = await adminDb
        .collection(COLLECTIONS.PROJECTS)
        .where("user_id", "==", user.uid)
        .where("is_archived", "==", false)
        .get();

      projects = projectsSnapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Untitled Project",
            createdAt:
              typeof data.created_at === "string"
                ? data.created_at
                : new Date().toISOString(),
          };
        })
        .sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .map((project) => ({
          id: project.id,
          name: project.name,
        }));
    }

    return NextResponse.json({
      userName,
      userEmail: user.email || null,
      recentChats,
      projects,
    });
  } catch (err) {
    console.error("Dashboard data error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to fetch dashboard data";
    console.error("Full error details:", {
      message: errorMessage,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? (err instanceof Error ? err.stack : String(err)) : undefined
      },
      { status: 500 }
    );
  }
}
