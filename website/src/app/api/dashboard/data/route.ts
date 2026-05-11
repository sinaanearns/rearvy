import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { isLegacySystemChat } from "@/lib/chat/system-chats";
import { handleApiError } from "@/lib/api-error";

type DashboardChatRecord = Record<string, unknown> & {
  id: string;
  is_archived?: boolean;
  is_pinned?: boolean;
  title?: unknown;
  system_chat_type?: unknown;
  updated_at?: unknown;
};

function getTimestamp(value: unknown) {
  if (value && typeof value === "object") {
    const timestampValue = value as {
      toDate?: () => Date;
      _seconds?: unknown;
      _nanoseconds?: unknown;
      seconds?: unknown;
      nanoseconds?: unknown;
    };

    if (typeof timestampValue.toDate === "function") {
      try {
        const date = timestampValue.toDate();
        const time = date instanceof Date ? date.getTime() : Number.NaN;
        if (Number.isFinite(time)) {
          return time;
        }
      } catch {
        // Fall through to other timestamp shapes.
      }
    }

    const seconds =
      typeof timestampValue._seconds === "number"
        ? timestampValue._seconds
        : typeof timestampValue.seconds === "number"
          ? timestampValue.seconds
          : null;
    const nanoseconds =
      typeof timestampValue._nanoseconds === "number"
        ? timestampValue._nanoseconds
        : typeof timestampValue.nanoseconds === "number"
          ? timestampValue.nanoseconds
          : 0;

    if (seconds !== null) {
      return seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" || value instanceof Date) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  return 0;
}

export async function GET(request: NextRequest) {
  let user: any;
  let userId: string | null = null;
  try {
    const result = await requireAuth(request);
    user = result.user;
    userId = user?.uid ?? null;
    const authError = result.error;
    if (authError) return authError;

    try {
      // Fetch profile
      const profileDoc = await adminDb
        .collection(COLLECTIONS.PROFILES)
        .doc(user.uid)
        .get();
      const profile = profileDoc.data();
      const userName = profile?.full_name || null;

      // Fetch recent chats - include chats the user owns and chats they participate in.
      let recentChats: Array<{ id: string; title: string; updated_at: string }> = [];
      try {
        const [ownerChatsSnapshot, participantChatsSnapshot] = await Promise.all([
          adminDb
            .collection(COLLECTIONS.CHATS)
            .where("user_id", "==", user.uid)
            .get(),
          adminDb
            .collection(COLLECTIONS.CHATS)
            .where("participant_ids", "array-contains", user.uid)
            .get(),
        ]);

        const chatMap = new Map<string, DashboardChatRecord>();

        ownerChatsSnapshot.docs.forEach((doc) => {
          chatMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        participantChatsSnapshot.docs.forEach((doc) => {
          chatMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        recentChats = Array.from(chatMap.values())
          .filter((chat) => !chat.is_archived && !isLegacySystemChat(chat))
          .sort((a, b) => {
            const pinDelta = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
            if (pinDelta !== 0) {
              return pinDelta;
            }

            return getTimestamp(b.updated_at) - getTimestamp(a.updated_at);
          })
          .slice(0, 20)
          .map((chat) => ({
            id: chat.id,
            title: typeof chat.title === "string" && chat.title.trim() ? chat.title : "Untitled",
            updated_at:
              typeof chat.updated_at === "string"
                ? chat.updated_at
                : new Date().toISOString(),
          }));
      } catch (chatErr) {
        console.warn("Failed to fetch ordered chats, trying without orderBy:", chatErr);
        const [ownerChatsSnapshot, participantChatsSnapshot] = await Promise.all([
          adminDb
            .collection(COLLECTIONS.CHATS)
            .where("user_id", "==", user.uid)
            .get(),
          adminDb
            .collection(COLLECTIONS.CHATS)
            .where("participant_ids", "array-contains", user.uid)
            .get(),
        ]);

        const chatMap = new Map<string, DashboardChatRecord>();

        ownerChatsSnapshot.docs.forEach((doc) => {
          chatMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        participantChatsSnapshot.docs.forEach((doc) => {
          chatMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        recentChats = Array.from(chatMap.values())
          .filter((chat) => !chat.is_archived && !isLegacySystemChat(chat))
          .sort((a, b) => {
            const pinDelta = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
            if (pinDelta !== 0) {
              return pinDelta;
            }

            return getTimestamp(b.updated_at) - getTimestamp(a.updated_at);
          })
          .slice(0, 20)
          .map((chat) => ({
            id: chat.id,
            title: typeof chat.title === "string" && chat.title.trim() ? chat.title : "Untitled",
            updated_at:
              typeof chat.updated_at === "string"
                ? chat.updated_at
                : new Date().toISOString(),
          }));
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
    } catch (dbError) {
      console.error("Dashboard Firestore fetch failed, returning fallback payload:", dbError);
      return NextResponse.json({
        userName: null,
        userEmail: user.email || null,
        recentChats: [],
        projects: [],
        _fallback: true,
      });
    }
  } catch (err) {
    return handleApiError(err, "GET /api/dashboard/data", { userId });
  }
}
