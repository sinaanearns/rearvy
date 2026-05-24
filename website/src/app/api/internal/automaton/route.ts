import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    success: true,
    skipped: true,
    reason:
      "Legacy Automaton callbacks are accepted for compatibility. New work is handled by the event-driven Operations runtime.",
  });
}
