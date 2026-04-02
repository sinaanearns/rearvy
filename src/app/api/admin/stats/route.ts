import { NextRequest, NextResponse } from "next/server";
import {
  getAdminSessionEmail,
  isAdminAuthenticated,
} from "@/lib/admin-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

function toMillis(value: unknown): number {
  if (!value) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  if (typeof value === "object" && value && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  return 0;
}

function toIso(value: unknown): string {
  const millis = toMillis(value);
  return millis > 0 ? new Date(millis).toISOString() : new Date().toISOString();
}

type AdminUserRow = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

async function fetchAllAdminUsers(): Promise<AdminUserRow[]> {
  const users: AdminUserRow[] = [];
  let nextPageToken: string | undefined;

  do {
    const page = await adminAuth.listUsers(1000, nextPageToken);
    users.push(
      ...page.users.map((user) => ({
        uid: user.uid,
        email: user.email || null,
        displayName: user.displayName || null,
        disabled: Boolean(user.disabled),
        createdAt: user.metadata.creationTime || new Date().toISOString(),
        lastSignInAt: user.metadata.lastSignInTime || null,
      }))
    );
    nextPageToken = page.pageToken || undefined;
  } while (nextPageToken);

  return users;
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startedAt = Date.now();
    const adminEmail = await getAdminSessionEmail();
    const adminUser = adminEmail ? await adminAuth.getUserByEmail(adminEmail) : null;

    // 1. Get Total Users
    const users = await fetchAllAdminUsers();
    const totalUsers = users.length;

    // 2. Get Total Chats
    const chatsSnapshot = await adminDb.collection(COLLECTIONS.CHATS).get();
    const totalChats = chatsSnapshot.size;

    // 3. Get Revenue
    const billingSnapshot = await adminDb
      .collection(COLLECTIONS.RAZORPAY_PAYMENTS)
      .where("status", "==", "captured")
      .get();

    let totalRevenue = 0;
    billingSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      totalRevenue += Number(data.amount || 0);
    });
    const currency = billingSnapshot.docs[0]?.data()?.currency || "USD";

        const [websiteEventsSnapshot, societyIdeasSnapshot, societiesSnapshot] =
          await Promise.all([
            adminDb
              .collection(COLLECTIONS.WEBSITE_EVENTS)
              .orderBy("timestamp", "desc")
              .limit(5)
              .get(),
            adminDb
              .collection(COLLECTIONS.SOCIETY_IDEAS)
              .orderBy("created_at", "desc")
              .limit(5)
              .get(),
            adminDb
              .collection(COLLECTIONS.SOCIETIES)
              .orderBy("created_at", "desc")
              .limit(5)
              .get(),
          ]);

        const websiteEventCount = (
          await adminDb.collection(COLLECTIONS.WEBSITE_EVENTS).get()
        ).size;

        const societyIdeasCount = (
          await adminDb.collection(COLLECTIONS.SOCIETY_IDEAS).get()
        ).size;

        const totalSocieties = (
          await adminDb.collection(COLLECTIONS.SOCIETIES).get()
        ).size;

        const recentActivities = [
          ...websiteEventsSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              source: "website_event",
              title: data.event_name || data.event_type || "Website event",
              detail: data.path || data.url || data.website_id || "Tracked activity",
              status: data.event_type || "tracked",
              timestamp: toIso(data.timestamp),
            };
          }),
          ...societyIdeasSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              source: "society_idea",
              title: data.name || "Society idea",
              detail: data.category ? `${data.category} idea submitted` : "Idea submitted",
              status: data.status || "submitted",
              timestamp: toIso(data.created_at),
            };
          }),
          ...societiesSnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              source: "society",
              title: data.name || "Rearvy Society",
              detail: data.description || data.category || "Business created",
              status: data.status || "active",
              timestamp: toIso(data.created_at),
            };
          }),
        ]
          .sort(
            (a, b) => toMillis(b.timestamp) - toMillis(a.timestamp)
          )
          .slice(0, 8);

        const recentBusinesses = societiesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Rearvy Society",
            description: data.description || null,
            category: data.category || "other",
            status: data.status || "active",
            stage: data.stage || "building",
            member_count: data.member_count || 0,
            founder_id: data.founder_id || null,
            created_at: toIso(data.created_at),
          };
        });

        const latestTimestamp = recentActivities[0]?.timestamp || null;
        const latestActivityAgeMinutes = latestTimestamp
          ? Math.floor((Date.now() - new Date(latestTimestamp).getTime()) / 60000)
          : null;
    
    return NextResponse.json({
          adminEmail,
      adminUid: adminUser?.uid || null,
      stats: {
        totalUsers,
        activeChats: totalChats,
        revenue: totalRevenue,
        currency,
        latency: `${Date.now() - startedAt}ms`,
            websiteEventCount,
            societyIdeasCount,
            totalSocieties,
            latestActivityAgeMinutes,
          },
          recentActivities,
          recentBusinesses,
          users,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
