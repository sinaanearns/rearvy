import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { aiCompletionService } from "@/lib/ai/model-router";
import { requireAuth } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";
import { isRecord } from "@/lib/api/request-body";

const log = createServerLogger("DesktopAppClassifierApi");

export const runtime = "nodejs";

const AppClassificationSchema = z.object({
  classifications: z.array(
    z.object({
      name: z.string().describe("The original input app name"),
      displayName: z.string().describe("Clean title-case display name of the software"),
      slot: z
        .string()
        .describe(
          "Slot identifier in lowercase snake_case (e.g. video_editor, code_editor, ai_coding_assistant, design_software, communication, productivity, browser, terminal, music_or_audio, emulator, game_launcher, screen_recorder, media_player, file_utility, api_tool, devops_tool, cloud_storage, vpn_security, database_tool)"
        ),
      importance: z.number().min(1).max(10).describe("1-10 importance score (9=essential tool like VS Code, 5=minor utility)"),
      description: z.string().optional().describe("Short 1-sentence description of what the app does"),
    })
  ),
});

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const desktopHeader = request.headers.get("x-rearvy-desktop");
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  const isDesktopRequest =
    desktopHeader === "1" ||
    desktopHeader?.toLowerCase() === "true" ||
    userAgent.includes("electron");

  if (!isDesktopRequest) {
    return NextResponse.json(
      { error: "This endpoint only accepts requests from the Rearvy desktop app." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body) || !Array.isArray(body.apps)) {
    return NextResponse.json(
      { error: "Request body must contain an 'apps' array of strings." },
      { status: 400 }
    );
  }

  const rawApps = body.apps
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 100);

  if (rawApps.length === 0) {
    return NextResponse.json({ classifications: [] });
  }

  const prompt = `
    You are Rearvy's Software Intelligence Engine.
    Classify the following installed desktop applications into functional software categories (slots).

    LIST OF UNRECOGNIZED INSTALLED APPS:
    ${rawApps.map((app, i) => `${i + 1}. ${app}`).join("\n")}

    SLOT CATEGORY GUIDELINES:
    Use concise, lowercase snake_case slot names. Reuse existing slots if applicable, or invent a clean new snake_case slot if it fits a new software category.

    COMMON SLOTS:
    - video_editor (DaVinci Resolve, Premiere, CapCut, Kdenlive)
    - code_editor (VS Code, IntelliJ, PyCharm, Sublime)
    - ai_coding_assistant (Codex, Cursor, Claude Code, Antigravity, Aider)
    - design_software (Figma, Photoshop, Blender, AutoCAD)
    - communication (Slack, Teams, Discord, Zoom, WhatsApp)
    - productivity (Notion, Obsidian, Word, Excel, Todoist)
    - browser (Chrome, Edge, Firefox, Brave, Arc)
    - terminal (Windows Terminal, PowerShell, iTerm2, Git Bash)
    - music_or_audio (Spotify, Audacity, FL Studio, Ableton)
    - emulator (BlueStacks, NoxPlayer, LDPlayer, Dolphin, RPCS3)
    - game_launcher (Steam, Epic Games, GOG Galaxy, EA App)
    - screen_recorder (OBS Studio, Bandicam, Loom, ShareX)
    - media_player (VLC, PotPlayer, Plex, Kodi)
    - file_utility (7-Zip, WinRAR, TeraCopy)
    - api_tool (Postman, Insomnia, Hoppscotch)
    - devops_tool (Docker, Kubernetes, VirtualBox, Terraform)
    - cloud_storage (Google Drive, Dropbox, OneDrive)
    - vpn_security (NordVPN, ExpressVPN, WireGuard, Antivirus)
    - database_tool (DBeaver, TablePlus, DataGrip, pgAdmin)
    - other_software (Miscellaneous apps)

    For each app:
    1. Identify what the software is (do a web lookup if needed based on your knowledge base).
    2. Provide clean title-case displayName (e.g. "BlueStacks App Player").
    3. Choose or create the best snake_case slot (e.g. "emulator").
    4. Rate importance 1 to 10.
  `;

  try {
    const { object } = await aiCompletionService.generateObject({
      task: "json_classification",
      schema: AppClassificationSchema,
      prompt,
      timeoutMs: 25_000,
    });

    return NextResponse.json(object);
  } catch (error) {
    log.error("Failed to classify desktop apps:", error);
    // Fallback: return unclassified apps as other_software
    const fallback = rawApps.map((name) => ({
      name,
      displayName: name,
      slot: "other_software",
      importance: 5,
    }));
    return NextResponse.json({ classifications: fallback });
  }
}
