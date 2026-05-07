import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import {
  getWhisperNetSummary,
  runWhisperNetScanForUser,
} from "@/lib/whispernet/service";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await runWhisperNetScanForUser(adminDb, data.user.id, "manual");
    const summary = await getWhisperNetSummary(adminDb, data.user.id);

    return NextResponse.json({
      success: true,
      run: result,
      summary,
    });
  } catch (error) {
    console.error("Failed to run WhisperNet scan:", error);
    return NextResponse.json(
      { error: "Failed to run WhisperNet scan." },
      { status: 500 }
    );
  }
}
