import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { getCloudComputerSessionForUser } = await import(
    "@/lib/cloud-computer/service"
  );
  const result = await getCloudComputerSessionForUser({
    userId: auth.user.uid,
    sessionId: id,
    includeLiveView: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code || 404 }
    );
  }

  return NextResponse.json(result.session);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { stopCloudComputerSession } = await import("@/lib/cloud-computer/service");
  const result = await stopCloudComputerSession({
    userId: auth.user.uid,
    sessionId: id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.code || 400 }
    );
  }

  return NextResponse.json({ ok: true, session: result.session });
}
