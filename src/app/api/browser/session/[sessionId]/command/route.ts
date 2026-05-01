import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  _context: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  return NextResponse.json(
    {
      ok: false,
      error:
        "Browser command handling not yet implemented. Browser automation is available through app-controlled workflows.",
    },
    { status: 501 }
  );
}
