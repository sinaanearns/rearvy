import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    success: true,
    skipped: true,
    reason: "Automaton logs are handled by the desktop local API.",
  });
}
