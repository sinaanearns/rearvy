import { NextResponse, type NextRequest } from "next/server";
import {
  createContentRecreationPlan,
  normalizeReferenceFrames,
  type ContentRecreationShot,
} from "@/lib/ai/content-recreation-workflow";
import {
  isRecord,
  isRequestBodyError,
  readJsonRecord,
} from "@/lib/api/request-body";
import { requireAuth } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("VideoFrameAnalysisApi");

export interface FrameAnalysisRequest {
  topic?: string;
  frames?: string[];
  targetNiche?: string;
  referenceUrl?: string;
  sourceUseMode?: "reference_only" | "owned_or_licensed_assets";
}

export type ShotBreakdownItem = Pick<
  ContentRecreationShot,
  | "sceneIndex"
  | "timestamp"
  | "visualDescription"
  | "suggestedPrompt"
  | "onScreenText"
  | "cameraAngle"
  | "moodAndColor"
> & {
  durationSeconds: number;
  motionPlan: string;
  fusionPlan: string;
  audioDirection: string;
  inspirationNotes: string;
};

export interface VideoFrameAnalysisResponse {
  success: boolean;
  topic?: string;
  totalFramesAnalyzed: number;
  shots: ShotBreakdownItem[];
  overallStyle: string;
  pinterestSearchQueries: string[];
  assumptions: string[];
  confidenceScore: number;
  davinciResolvePlan: unknown;
  modelRoute?: unknown;
  error?: string;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readSourceUseMode(value: unknown) {
  return value === "owned_or_licensed_assets" ? value : "reference_only";
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }

  try {
    const rawBody = await readJsonRecord(req);
    if (!isRecord(rawBody)) {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const topic = readOptionalString(rawBody.topic) ?? "General Business Promo";
    const targetNiche = readOptionalString(rawBody.targetNiche) ?? "SaaS / Technology";
    const frames = normalizeReferenceFrames(rawBody.frames);
    const referenceUrl = readOptionalString(rawBody.referenceUrl);
    const sourceUseMode = readSourceUseMode(rawBody.sourceUseMode);

    log.info(
      `Analyzing ${frames.length} reference frames for topic "${topic}" in "${targetNiche}"`
    );

    const result = await createContentRecreationPlan({
      topic,
      targetNiche,
      referenceUrl,
      sourceUseMode,
      frames,
    });

    const response: VideoFrameAnalysisResponse = {
      success: true,
      topic: result.plan.topic,
      totalFramesAnalyzed: frames.length,
      shots: result.plan.shots,
      overallStyle: result.plan.overallStyle,
      pinterestSearchQueries: result.plan.pinterestSearchQueries,
      assumptions: result.plan.assumptions,
      confidenceScore: result.plan.confidenceScore,
      davinciResolvePlan: result.plan.davinciResolvePlan,
      modelRoute: result.modelRoute,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    log.error("Video frame analysis error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "NVIDIA video frame analysis failed.",
      },
      { status: 503 }
    );
  }
}
