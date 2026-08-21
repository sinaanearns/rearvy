import { requireAuth } from "@/lib/firebase/middleware";
import { adminStorage } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const log = createServerLogger("Api:StorageDownload");

/** GET /api/storage/download - signed download URL generation */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const userId = auth.user!.uid;

  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path");

  if (!filePath) {
    return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
  }

  try {
    const bucket = adminStorage.bucket();
    const destination = `users/${userId}/${filePath.replace(/^\//, "")}`;
    const file = bucket.file(destination);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return NextResponse.json({ ok: true, downloadUrl: url });
  } catch (error) {
    log.error("Failed to generate download URL", error);
    return NextResponse.json({ error: "Signed URL generation failed" }, { status: 500 });
  }
}
