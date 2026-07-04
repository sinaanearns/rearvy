import { requireAuth } from "@/lib/firebase/middleware";
import { adminStorage } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const log = createServerLogger("Api:StorageUpload");

/** POST /api/storage/upload - sandboxed cloud file uploads */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const userId = auth.user!.uid;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const customPath = formData.get("path") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // MIME type check
    const allowedMimes = [
      "text/plain",
      "text/markdown",
      "text/csv",
      "text/html",
      "application/json",
      "application/xml",
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }

    // Size limit check: 20MB
    const limitBytes = 20 * 1024 * 1024;
    if (file.size > limitBytes) {
      return NextResponse.json({ error: "File exceeds 20MB limit" }, { status: 400 });
    }

    const filename = customPath ? customPath.replace(/^\//, "") : file.name;
    const bucket = adminStorage.bucket();
    const destination = `users/${userId}/${filename}`;
    const cloudFile = bucket.file(destination);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await cloudFile.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    log.info(`Uploaded file through API: ${destination}`);
    return NextResponse.json({
      ok: true,
      path: filename,
      sizeBytes: file.size,
    });
  } catch (error) {
    log.error("Failed to upload file via endpoint", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
