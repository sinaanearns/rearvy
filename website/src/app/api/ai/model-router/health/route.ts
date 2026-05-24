import { NextResponse, type NextRequest } from "next/server";
import { getModelRouterHealth } from "@/lib/ai/model-router";

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
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      keyEnvVar: provider.keyEnvVar,
      defaultModel: provider.defaultModel,
      visionModel: provider.visionModel ?? null,
      capabilities: provider.capabilities,
      costTier: provider.costTier,
      configured: provider.configured,
      enabled: provider.enabled,
      health: provider.health,
    })),
  });
}
