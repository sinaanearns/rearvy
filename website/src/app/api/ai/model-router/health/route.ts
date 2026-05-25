import { NextResponse, type NextRequest } from "next/server";
import {
  getModelRouterHealth,
  getOpenRouterFreeModels,
} from "@/lib/ai/model-router";

export async function GET(request: NextRequest) {
  const desktopHeader = request.headers.get("x-rearvy-desktop") || "";
  const isDesktopApp =
    desktopHeader === "1" || desktopHeader.toLowerCase() === "true";
  const providers = await getModelRouterHealth({
    isDesktopApp,
    checkLocal: true,
  });

  return NextResponse.json({
    ok: true,
    freeFirst: true,
    eventDriven: true,
    checkedAt: new Date().toISOString(),
    openRouterFreeModels: getOpenRouterFreeModels(),
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      defaultModel: provider.defaultModel,
      taskModels: provider.taskModels ?? {},
      visionModel: provider.visionModel ?? null,
      capabilities: provider.capabilities,
      costTier: provider.costTier,
      configured: provider.configured,
      enabled: provider.enabled,
      configuration: provider.configured ? "configured" : "missing",
      health: provider.health
        ? {
            ...provider.health,
            reason: provider.configured
              ? "Provider is configured."
              : "Provider is not configured.",
          }
        : provider.health,
    })),
  });
}
