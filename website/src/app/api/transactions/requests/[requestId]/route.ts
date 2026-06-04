import { NextResponse, type NextRequest } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import {
  updateTransactionRequest,
  type TransactionRequestActionInput,
} from "@/lib/transactions/store";

function buildActionInput(
  body: Record<string, unknown>,
  actorUserId: string
): TransactionRequestActionInput {
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "approve") {
    return { action, actorUserId };
  }

  if (action === "reject") {
    return {
      action,
      actorUserId,
      error: typeof body.error === "string" ? body.error : null,
    };
  }

  if (action === "submit") {
    return {
      action,
      actorUserId,
      txHash: body.tx_hash ?? body.txHash,
      fromAddress: body.from_address ?? body.fromAddress,
      chainId: body.chain_id ?? body.chainId,
      walletUseApproved: body.wallet_use_approved ?? body.walletUseApproved,
      walletUseApprovedAt:
        body.wallet_use_approved_at ?? body.walletUseApprovedAt,
    };
  }

  if (action === "fail") {
    return {
      action,
      actorUserId,
      error: typeof body.error === "string" ? body.error : "Transaction failed.",
    };
  }

  throw new Error("Unsupported transaction request action.");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const { requestId } = await params;
  if (!requestId) {
    return NextResponse.json(
      { ok: false, error: "Missing transaction request id." },
      { status: 400 }
    );
  }

  try {
    const body = await readJsonRecord(request);
    const nextRequest = await updateTransactionRequest(
      adminDb,
      auth.user.uid,
      requestId,
      buildActionInput(body, auth.user.uid)
    );

    if (!nextRequest) {
      return NextResponse.json(
        { ok: false, error: "Transaction request not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, request: nextRequest });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update transaction request.",
      },
      { status: 400 }
    );
  }
}
