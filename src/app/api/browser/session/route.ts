import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        "Manual browser sessions are disabled. Rearvy can start browser automation only from app-controlled workflows.",
    },
    { status: 403 }
  );
}
