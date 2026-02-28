import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  generateSiteId,
  normalizeDomain,
  buildTrackingSnippet,
} from "@/lib/integrations/website/utils";
import { getAppOrigin } from "@/lib/utils/url";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  let body: { domain?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { domain: rawDomain, name } = body;
  if (!rawDomain) {
    return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  }

  const domain = normalizeDomain(rawDomain);
  if (!domain) {
    return NextResponse.json(
      { error: "Invalid domain format" },
      { status: 400 }
    );
  }

  // Check if domain already exists
  const existingSnapshot = await adminDb
    .collection(COLLECTIONS.WEBSITES)
    .where("user_id", "==", user.uid)
    .where("domain", "==", domain)
    .get();

  if (!existingSnapshot.empty) {
    return NextResponse.json(
      { error: "This domain is already connected" },
      { status: 409 }
    );
  }

  try {
    const siteId = generateSiteId();
    const appOrigin = getAppOrigin(request);
    const now = new Date();

    const websiteData = {
      id: siteId,
      user_id: user.uid,
      site_id: siteId,
      domain,
      name: name || domain,
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    // Create a Firestore document with auto-generated ID
    const newDocRef = await adminDb
      .collection(COLLECTIONS.WEBSITES)
      .add(websiteData);

    const website = {
      id: newDocRef.id,
      ...websiteData,
    };

    return NextResponse.json({
      website,
      snippet: buildTrackingSnippet(siteId, appOrigin),
    });
  } catch (error) {
    console.error("Failed to create website tracking:", error);
    return NextResponse.json(
      { error: "Failed to create website tracking" },
      { status: 500 }
    );
  }
}
