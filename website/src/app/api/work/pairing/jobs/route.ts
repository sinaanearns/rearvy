import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import {
  finishLocalWorkJob,
  pollLocalWorkJobs,
  queueLocalWorkJob,
} from "@/lib/work/pairing";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const deviceId = searchParams.get("deviceId") || "";
  const parsedLimit = Number(searchParams.get("limit") || 5);
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 5;

  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required." }, { status: 400 });
  }

  const jobs = await pollLocalWorkJobs(adminDb, auth.user.uid, deviceId, limit);
  if (!jobs) {
    return NextResponse.json({ error: "Paired device not found." }, { status: 404 });
  }

  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "queue";

  if (action === "queue") {
    const jobType =
      body.jobType === "browser_session" ||
      body.jobType === "terminal" ||
      body.jobType === "healthcheck"
        ? body.jobType
        : "desktop_workflow";
    const payload =
      body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : {};
    const job = await queueLocalWorkJob(adminDb, {
      userId: auth.user.uid,
      deviceId: typeof body.deviceId === "string" ? body.deviceId : null,
      runId: typeof body.runId === "string" ? body.runId : null,
      jobType,
      payload,
    });
    return NextResponse.json({ ok: true, job }, { status: 201 });
  }

  if (action === "finish") {
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    const jobId = typeof body.jobId === "string" ? body.jobId : "";
    if (!deviceId || !jobId) {
      return NextResponse.json({ error: "deviceId and jobId are required." }, { status: 400 });
    }
    const job = await finishLocalWorkJob(adminDb, auth.user.uid, deviceId, jobId, {
      status: typeof body.status === "string" ? body.status : "completed",
      result:
        body.result && typeof body.result === "object" && !Array.isArray(body.result)
          ? (body.result as Record<string, unknown>)
          : null,
      error: typeof body.error === "string" ? body.error : null,
    });
    if (!job) {
      return NextResponse.json({ error: "Local job not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, job });
  }

  return NextResponse.json({ error: "Unsupported local job action." }, { status: 400 });
}

