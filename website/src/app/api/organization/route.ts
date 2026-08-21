import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";

const log = createServerLogger("ApiOrganization");

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const snapshot = await adminDb
      .collection(COLLECTIONS.ORGANIZATIONS)
      .where("owner_user_id", "==", user.uid)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ organization: null });
    }

    const doc = snapshot.docs[0];
    return NextResponse.json({
      organization: {
        id: doc.id,
        ...doc.data(),
      },
    });
  } catch (error) {
    log.error("Organization GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const body = await readJsonRecord(request);
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const newOrg = {
      name,
      owner_user_id: user.uid,
      domain: typeof body.domain === "string" ? body.domain : null,
      brand_memory: {
        company_name: name,
        brand_colors: Array.isArray(body.brand_colors) ? body.brand_colors : ["#6366F1", "#06B6D4"],
        logo_url: typeof body.logo_url === "string" ? body.logo_url : null,
        writing_style: typeof body.writing_style === "string" ? body.writing_style : "Professional & persuasive",
        tone: typeof body.tone === "string" ? body.tone : "Authoritative",
      },
      created_at: now,
      updated_at: now,
    };

    const docRef = await adminDb.collection(COLLECTIONS.ORGANIZATIONS).add(newOrg);

    // Add owner as org member
    await adminDb.collection(COLLECTIONS.ORGANIZATION_MEMBERS).add({
      org_id: docRef.id,
      user_id: user.uid,
      email: user.email || "",
      role: "owner",
      granted_permissions: ["*"],
      created_at: now,
      updated_at: now,
    });

    return NextResponse.json({
      id: docRef.id,
      ...newOrg,
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    log.error("Organization POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
