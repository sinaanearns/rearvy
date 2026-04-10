import { NextResponse } from "next/server";
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

export async function GET() {
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

        const [
          websiteEventsSnapshot,
        ] =
          await Promise.all([
            adminDb
              .collection(COLLECTIONS.WEBSITE_EVENTS)
              .orderBy("timestamp", "desc")
              .limit(5)
              .get(),
          ]);

        const websiteEventCount = (
          await adminDb.collection(COLLECTIONS.WEBSITE_EVENTS).get()
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
        ]
          .sort(
            (a, b) => toMillis(b.timestamp) - toMillis(a.timestamp)
          )
          .slice(0, 8);

        const recentBusinesses: any[] = [];

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
