import { NextResponse, type NextRequest } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  generateSiteId,
  normalizeDomain,
  buildTrackingSnippet,
} from "@/lib/integrations/website/utils";
import { createServerLogger } from "@/lib/server-logger";
import { getAppOrigin } from "@/lib/utils/url";
import { randomBytes } from "crypto";

const log = createServerLogger("WebsiteConnectApi");

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await readJsonRecord(request);
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    throw error;
  }

  const rawDomain = optionalString(body.domain);
  const name = optionalString(body.name);
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
      tracking_secret: randomBytes(24).toString("hex"),
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
      ...websiteData,
      id: newDocRef.id,
    };

    return NextResponse.json({
      website,
      snippet: buildTrackingSnippet(siteId, appOrigin, websiteData.tracking_secret),
    });
  } catch (error) {
    log.error("Failed to create website tracking:", error);
    return NextResponse.json(
      { error: "Failed to create website tracking" },
      { status: 500 }
    );
  }
}
