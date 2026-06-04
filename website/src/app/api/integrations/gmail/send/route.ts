import { NextResponse, type NextRequest } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import {
  gmailSendActionRequestSchema,
  type GmailSendActionRequest,
} from "@/lib/integrations/gmail/compose-shared";
import {
  createGmailDraft,
  findSendAsOption,
  getGmailComposeCapabilities,
  loadGmailConnectionForUser,
  loadGmailSendAsOptions,
  sendGmailMessage,
} from "@/lib/integrations/gmail/server";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("GmailSendApi");

function buildScopeErrorMessage(action: GmailSendActionRequest["action"]) {
  return action === "send"
    ? "Reconnect Gmail to grant send access before Rearvy can send this email."
    : "Reconnect Gmail to grant compose access before Rearvy can create a draft.";
}

function isPermissionError(message: string) {
  return (
    message.includes("insufficientPermissions") ||
    message.includes("permission") ||
    message.includes("scope")
  );
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  try {
    const payload = await readJsonRecord(request);
    const parsed = gmailSendActionRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid Gmail request payload.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const connection = await loadGmailConnectionForUser(adminDb, user.uid);
    if (!connection.ok) {
      return NextResponse.json(
        {
          error: connection.message,
          errorCode: connection.errorCode,
        },
        { status: connection.errorCode === "GMAIL_NOT_CONNECTED" ? 404 : 409 }
      );
    }

    const capabilities = getGmailComposeCapabilities(
      connection.integration.scopes
    );
    if (
      (parsed.data.action === "draft" && !capabilities.canCreateDraft) ||
      (parsed.data.action === "send" && !capabilities.canSend)
    ) {
      return NextResponse.json(
        {
          error: buildScopeErrorMessage(parsed.data.action),
          errorCode: "GMAIL_SEND_SCOPE_MISSING",
        },
        { status: 409 }
      );
    }

    const { options } = await loadGmailSendAsOptions(connection);
    const selectedFrom =
      findSendAsOption(options, parsed.data.fromEmail) ||
      findSendAsOption(options, null);

    if (!selectedFrom) {
      return NextResponse.json(
        {
          error:
            "Rearvy could not determine which Gmail address should send this message.",
          errorCode: "GMAIL_SEND_FROM_UNAVAILABLE",
        },
        { status: 400 }
      );
    }

    const result =
      parsed.data.action === "draft"
        ? await createGmailDraft({
            config: connection.config,
            draft: parsed.data.draft,
            from: selectedFrom,
          })
        : await sendGmailMessage({
            config: connection.config,
            draft: parsed.data.draft,
            from: selectedFrom,
          });

    if (!result.ok) {
      const permissionError =
        result.status === 403 || isPermissionError(result.message);

      return NextResponse.json(
        {
          error: permissionError
            ? buildScopeErrorMessage(parsed.data.action)
            : "Gmail rejected the request. Please try again.",
          errorCode: permissionError
            ? "GMAIL_SEND_SCOPE_MISSING"
            : "GMAIL_ACTION_FAILED",
          details: result.message,
        },
        { status: permissionError ? 409 : result.status || 500 }
      );
    }

    const performedAt = new Date().toISOString();

    if (parsed.data.action === "draft") {
      const draftData = result.data as {
        id?: string;
        message?: {
          threadId?: string;
        };
      };

      return NextResponse.json({
        ok: true,
        action: "draft",
        id: typeof draftData.id === "string" ? draftData.id : null,
        threadId:
          typeof draftData.message?.threadId === "string"
            ? draftData.message.threadId
            : null,
        fromEmail: selectedFrom.email,
        performedAt,
        message: "Gmail draft created successfully.",
      });
    }

    const sendData = result.data as {
      id?: string;
      threadId?: string;
    };

    return NextResponse.json({
      ok: true,
      action: "send",
      id: typeof sendData.id === "string" ? sendData.id : null,
      threadId:
        typeof sendData.threadId === "string" ? sendData.threadId : null,
      fromEmail: selectedFrom.email,
      performedAt,
      message: "Email sent successfully through Gmail.",
    });
  } catch (routeError) {
    if (isRequestBodyError(routeError)) {
      return NextResponse.json({ error: routeError.message }, { status: 400 });
    }

    log.error("Gmail send route error:", routeError);
    return NextResponse.json(
      {
        error: "Failed to process Gmail action.",
      },
      { status: 500 }
    );
  }
}
