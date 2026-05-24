import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import {
  createTransactionRequest,
  listTransactionRequests,
} from "@/lib/transactions/store";
import type {
  TransactionRequestSource,
  TransactionRequestStatus,
} from "@/lib/transactions/types";

const VALID_STATUS = new Set<TransactionRequestStatus | "open">([
  "draft",
  "awaiting_approval",
  "approved",
  "rejected",
  "submitted",
  "failed",
  "open",
]);

const VALID_SOURCES = new Set<TransactionRequestSource>([
  "ai_suggestion",
  "manual",
  "user_action",
  "operations_console",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }

  return undefined;
}

function parseSource(value: unknown): TransactionRequestSource | undefined {
  return typeof value === "string" && VALID_SOURCES.has(value as TransactionRequestSource)
    ? (value as TransactionRequestSource)
    : undefined;
}

function parseStatus(value: string | null): TransactionRequestStatus | "open" | undefined {
  return value && VALID_STATUS.has(value as TransactionRequestStatus | "open")
    ? (value as TransactionRequestStatus | "open")
    : undefined;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const status = parseStatus(request.nextUrl.searchParams.get("status"));
  const parsedLimit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "", 10);
  const requests = await listTransactionRequests(adminDb, auth.user.uid, {
    status,
    limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
  });

  return NextResponse.json({ ok: true, requests });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const body = asRecord(await request.json().catch(() => ({})));
  const transaction = asRecord(body.transaction);
  const source = { ...body, ...transaction };

  try {
    const draft = await createTransactionRequest(adminDb, {
      userId: auth.user.uid,
      chatId: typeof source.chat_id === "string" ? source.chat_id : typeof source.chatId === "string" ? source.chatId : null,
      projectId:
        typeof source.project_id === "string"
          ? source.project_id
          : typeof source.projectId === "string"
            ? source.projectId
            : null,
      agentRunId:
        typeof source.agent_run_id === "string"
          ? source.agent_run_id
          : typeof source.agentRunId === "string"
            ? source.agentRunId
            : null,
      source: parseSource(source.source),
      fromAddress: firstValue(source, "from_address", "fromAddress"),
      toAddress: firstValue(source, "to_address", "toAddress", "to"),
      chainId: firstValue(source, "chain_id", "chainId"),
      networkName:
        typeof firstValue(source, "network_name", "networkName") === "string"
          ? (firstValue(source, "network_name", "networkName") as string)
          : null,
      amountEth: firstValue(source, "amount_eth", "amountEth", "amount", "native_amount"),
      reason: typeof source.reason === "string" ? source.reason : null,
      riskSummary:
        typeof source.risk_summary === "string"
          ? source.risk_summary
          : typeof source.riskSummary === "string"
            ? source.riskSummary
            : null,
      forbiddenFields: source,
    });

    return NextResponse.json({ ok: true, request: draft }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create transaction draft.",
      },
      { status: 400 }
    );
  }
}
