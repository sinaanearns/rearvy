import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { normalizeRearvyDisplayText } from "@/lib/brand-display";
import { isLegacySystemChat } from "@/lib/chat/system-chats";
import { handleApiError } from "@/lib/api-error";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("DashboardDataApi");

type DashboardChatRecord = Record<string, unknown> & {
  id: string;
  is_archived?: boolean;
  is_pinned?: boolean;
  is_group?: boolean;
  user_id?: unknown;
  project_id?: unknown;
  title?: unknown;
  system_chat_type?: unknown;
  updated_at?: unknown;
};

type RecentDashboardChat = {
  id: string;
  user_id?: string;
  is_owner: boolean;
  project_id: string | null;
  title: string;
  updated_at: string | null;
  is_pinned: boolean;
  is_group: boolean;
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

function toIsoTimestamp(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  const timestamp = getTimestamp(value);
  return timestamp > 0 ? new Date(timestamp).toISOString() : null;
}

function toRecentDashboardChat(chat: DashboardChatRecord, userId: string): RecentDashboardChat {
  const ownerId = typeof chat.user_id === "string" ? chat.user_id : undefined;

  return {
    id: chat.id,
    ...(ownerId ? { user_id: ownerId } : {}),
    is_owner: ownerId === userId,
    project_id: typeof chat.project_id === "string" ? chat.project_id : null,
    title: normalizeRearvyDisplayText(chat.title) ?? "Untitled",
    updated_at: toIsoTimestamp(chat.updated_at),
    is_pinned: chat.is_pinned === true,
    is_group: chat.is_group === true,
  };
}

export async function GET(request: NextRequest) {
  let userId: string | null = null;
  try {
    const { user, error: authError } = await requireAuth(request);
    if (authError) return authError;
    userId = user.uid;

    try {
      // Fetch profile
      const profileDoc = await adminDb
        .collection(COLLECTIONS.PROFILES)
        .doc(user.uid)
        .get();
      const profile = profileDoc.data();
      const userName = normalizeRearvyDisplayText(profile?.full_name);

      // Fetch recent chats - include chats the user owns and chats they participate in.
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

      const recentChats = Array.from(chatMap.values())
        .filter((chat) => !chat.is_archived && !isLegacySystemChat(chat))
        .sort((a, b) => {
          const pinDelta = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
          if (pinDelta !== 0) {
            return pinDelta;
          }

          return getTimestamp(b.updated_at) - getTimestamp(a.updated_at);
        })
        .slice(0, 20)
        .map((chat) => toRecentDashboardChat(chat, user.uid));

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
            name: normalizeRearvyDisplayText(data.name) ?? "Untitled Project",
          };
        });
      } catch (projectErr) {
        log.warn("Failed to fetch ordered projects, trying without orderBy:", projectErr);
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
              name: normalizeRearvyDisplayText(data.name) ?? "Untitled Project",
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
      log.error("Dashboard Firestore fetch failed, returning fallback payload:", dbError);
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
