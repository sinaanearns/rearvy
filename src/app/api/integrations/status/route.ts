import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getConfiguredIntegrationProviders } from "@/lib/integrations/provider-config";

export async function GET(request: NextRequest) {
  try {
    // Get user from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get integrations
    const integrationsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", userId)
      .get();

    const integrations = integrationsSnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    // Get counts of synced data
    const [
      productsSnapshot,
      ordersSnapshot,
      videosSnapshot,
      youtubeCommentsSnapshot,
      instagramPostsSnapshot,
      instagramCommentsSnapshot,
      websitesSnapshot,
      websitePageviewsSnapshot,
      websiteSessionsSnapshot,
      facebookPostsSnapshot,
      facebookCommentsSnapshot,
      githubReposSnapshot,
      githubIssuesSnapshot,
      githubPullRequestsSnapshot,
      razorpayPaymentsSnapshot,
      gmailMessagesSnapshot,
      excelWorkbooksSnapshot,
      excelRowsSnapshot,
    ] = await Promise.all([
      adminDb.collection(COLLECTIONS.PRODUCTS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.ORDERS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.YOUTUBE_VIDEOS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.YOUTUBE_COMMENTS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.INSTAGRAM_POSTS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.INSTAGRAM_COMMENTS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.WEBSITES).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.WEBSITE_PAGEVIEWS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.WEBSITE_SESSIONS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.FACEBOOK_POSTS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.FACEBOOK_COMMENTS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.GITHUB_REPOS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.GITHUB_ISSUES).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.GITHUB_PULL_REQUESTS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.RAZORPAY_PAYMENTS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.GMAIL_MESSAGES).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.EXCEL_WORKBOOKS).where("user_id", "==", userId).get(),
      adminDb.collection(COLLECTIONS.EXCEL_ROWS).where("user_id", "==", userId).get(),
    ]);

    const websites = websitesSnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    return NextResponse.json({
      integrations,
      websites,
      configuredProviders: getConfiguredIntegrationProviders(),
      syncedData: {
        products: productsSnapshot.size,
        orders: ordersSnapshot.size,
        videos: videosSnapshot.size,
        youtubeComments: youtubeCommentsSnapshot.size,
        instagramPosts: instagramPostsSnapshot.size,
        instagramComments: instagramCommentsSnapshot.size,
        websitePageviews: websitePageviewsSnapshot.size,
        websiteSessions: websiteSessionsSnapshot.size,
        facebookPosts: facebookPostsSnapshot.size,
        facebookComments: facebookCommentsSnapshot.size,
        githubRepos: githubReposSnapshot.size,
        githubIssues: githubIssuesSnapshot.size,
        githubPullRequests: githubPullRequestsSnapshot.size,
        razorpayPayments: razorpayPaymentsSnapshot.size,
        gmailMessages: gmailMessagesSnapshot.size,
        excelWorkbooks: excelWorkbooksSnapshot.size,
        excelRows: excelRowsSnapshot.size,
      },
    });
  } catch (error) {
    console.error("Status route error:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}
