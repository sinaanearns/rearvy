import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { requireAuth } from "@/lib/firebase/middleware";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import {
  getDefaultAutomationPolicy,
  normalizeAutomationPolicyPatch,
} from "@/lib/automation/policies";
import type { AutomationPolicy } from "@/lib/agent-events/types";

async function loadPolicy(userId: string) {
  const defaultPolicy = getDefaultAutomationPolicy(userId);
  const policyRef = adminDb.collection(COLLECTIONS.AUTOMATION_POLICIES).doc(userId);
  const policySnap = await policyRef.get();

  if (!policySnap.exists) {
    return defaultPolicy;
  }

  return {
    ...defaultPolicy,
    ...(policySnap.data() as Partial<AutomationPolicy>),
    id: userId,
    user_id: userId,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  const policy = await loadPolicy(auth.user.uid);
  return NextResponse.json({ ok: true, policy });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const currentPolicy = await loadPolicy(auth.user.uid);
    const body = await readJsonRecord(request);
    const policy = normalizeAutomationPolicyPatch(body, currentPolicy);

    await adminDb
      .collection(COLLECTIONS.AUTOMATION_POLICIES)
      .doc(auth.user.uid)
      .set(policy, { merge: true });

    return NextResponse.json({ ok: true, policy });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    throw error;
  }
}
