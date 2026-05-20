import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params;

    // If running in desktop, client should call window.electron.automation
    // This route is a fallback for non-desktop deployments or proxies.

    // For now, return 404 to indicate no server-side session store.
    return NextResponse.json({ error: "No desktop session on server" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: "Internal" }, { status: 500 });
  }
}
