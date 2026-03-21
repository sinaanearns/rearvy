import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { getWhisperNetSummary } from "@/lib/whispernet/service";

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const summary = await getWhisperNetSummary(adminDb, data.user.id);
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to load WhisperNet summary:", error);
    return NextResponse.json(
      { error: "Failed to load WhisperNet summary." },
      { status: 500 }
    );
  }
}
