import { createHash, randomBytes } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type WorkLocalJob, type WorkPairedDevice, type WorkPairingToken } from "@/lib/firebase/schema";

function nowIso() {
  return new Date().toISOString();
}

function hashCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

function makePairingCode() {
  return randomBytes(5).toString("hex").toUpperCase();
}

function readString(value: unknown, fallback = "", maxLength = 500) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 40);
}

function readIsoString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    try {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime())
        ? date.toISOString()
        : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function tokenFromDoc(id: string, data: Record<string, unknown>): WorkPairingToken {
  return {
    id,
    user_id: String(data.user_id || ""),
    code_hash: String(data.code_hash || ""),
    label: String(data.label || "Desktop pairing"),
    status:
      data.status === "claimed" || data.status === "expired" || data.status === "revoked"
        ? data.status
        : "pending",
    claimed_device_id: typeof data.claimed_device_id === "string" ? data.claimed_device_id : null,
    expires_at: readIsoString(data.expires_at),
    created_at: readIsoString(data.created_at),
    updated_at: readIsoString(data.updated_at),
  };
}

function deviceFromDoc(id: string, data: Record<string, unknown>): WorkPairedDevice {
  return {
    id,
    user_id: String(data.user_id || ""),
    device_name: String(data.device_name || "Desktop"),
    device_type:
      data.device_type === "desktop" ||
      data.device_type === "browser" ||
      data.device_type === "mobile"
        ? data.device_type
        : "unknown",
    status: data.status === "inactive" || data.status === "revoked" ? data.status : "active",
    last_seen_at: typeof data.last_seen_at === "string" ? data.last_seen_at : null,
    pairing_token_id: typeof data.pairing_token_id === "string" ? data.pairing_token_id : null,
    capabilities: normalizeStringArray(data.capabilities),
    local_runtime: Boolean(data.local_runtime),
    created_at: readIsoString(data.created_at),
    updated_at: readIsoString(data.updated_at),
  };
}

export async function createPairingToken(
  db: Firestore,
  userId: string,
  input: { label?: string | null; ttlMinutes?: number } = {}
) {
  const code = makePairingCode();
  const now = nowIso();
  const ttlMinutes = Math.min(Math.max(input.ttlMinutes || 15, 1), 120);
  const tokenRef = db.collection(COLLECTIONS.WORK_PAIRING_TOKENS).doc();
  const token: WorkPairingToken = {
    id: tokenRef.id,
    user_id: userId,
    code_hash: hashCode(code),
    label: readString(input.label, "Desktop pairing", 120),
    status: "pending",
    claimed_device_id: null,
    expires_at: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
    created_at: now,
    updated_at: now,
  };

  await tokenRef.set(token);
  return {
    token,
    code,
    deepLink: `rearvy://pair?code=${encodeURIComponent(code)}`,
  };
}

export async function claimPairingToken(
  db: Firestore,
  userId: string,
  input: {
    code: string;
    deviceName?: string | null;
    deviceType?: string | null;
    capabilities?: unknown;
  }
) {
  const codeHash = hashCode(input.code);
  const snapshot = await db
    .collection(COLLECTIONS.WORK_PAIRING_TOKENS)
    .where("user_id", "==", userId)
    .where("status", "==", "pending")
    .get();
  const now = nowIso();
  const tokenDoc = snapshot.docs.find((doc) => {
    const token = tokenFromDoc(doc.id, doc.data());
    return token.code_hash === codeHash && token.expires_at > now;
  });

  if (!tokenDoc) {
    return null;
  }

  const deviceRef = db.collection(COLLECTIONS.WORK_PAIRED_DEVICES).doc();
  const device: WorkPairedDevice = {
    id: deviceRef.id,
    user_id: userId,
    device_name: readString(input.deviceName, "Rearvy Desktop", 120),
    device_type: input.deviceType === "browser" || input.deviceType === "mobile" ? input.deviceType : "desktop",
    status: "active",
    last_seen_at: now,
    pairing_token_id: tokenDoc.id,
    capabilities: normalizeStringArray(input.capabilities),
    local_runtime: true,
    created_at: now,
    updated_at: now,
  };

  const batch = db.batch();
  batch.set(deviceRef, device);
  batch.set(
    db.collection(COLLECTIONS.WORK_PAIRING_TOKENS).doc(tokenDoc.id),
    {
      status: "claimed",
      claimed_device_id: deviceRef.id,
      updated_at: now,
    },
    { merge: true }
  );
  await batch.commit();

  return device;
}

export async function listPairedDevices(db: Firestore, userId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.WORK_PAIRED_DEVICES)
    .where("user_id", "==", userId)
    .get();
  return snapshot.docs
    .map((doc) => deviceFromDoc(doc.id, doc.data()))
    .sort((left, right) => String(right.last_seen_at || "").localeCompare(String(left.last_seen_at || "")));
}

export async function heartbeatPairedDevice(
  db: Firestore,
  userId: string,
  deviceId: string,
  capabilities?: unknown
) {
  const ref = db.collection(COLLECTIONS.WORK_PAIRED_DEVICES).doc(deviceId);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!snapshot.exists || !data || data.user_id !== userId) {
    return null;
  }
  const existingDevice = deviceFromDoc(snapshot.id, data);
  if (existingDevice.status === "revoked") {
    return existingDevice;
  }
  const now = nowIso();
  const nextCapabilities = normalizeStringArray(capabilities);
  await ref.set(
    {
      status: "active",
      last_seen_at: now,
      capabilities: nextCapabilities.length ? nextCapabilities : existingDevice.capabilities,
      updated_at: now,
    },
    { merge: true }
  );
  return {
    ...existingDevice,
    status: "active" as const,
    last_seen_at: now,
    capabilities: nextCapabilities.length ? nextCapabilities : existingDevice.capabilities,
    updated_at: now,
  };
}

export async function revokePairedDevice(db: Firestore, userId: string, deviceId: string) {
  const ref = db.collection(COLLECTIONS.WORK_PAIRED_DEVICES).doc(deviceId);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!snapshot.exists || !data || data.user_id !== userId) {
    return null;
  }
  const now = nowIso();
  await ref.set({ status: "revoked", updated_at: now }, { merge: true });
  return { ...deviceFromDoc(snapshot.id, data), status: "revoked" as const, updated_at: now };
}

export async function queueLocalWorkJob(
  db: Firestore,
  input: {
    userId: string;
    deviceId?: string | null;
    runId?: string | null;
    jobType: WorkLocalJob["job_type"];
    payload: Record<string, unknown>;
  }
) {
  const now = nowIso();
  const ref = db.collection(COLLECTIONS.WORK_LOCAL_JOBS).doc();
  const job: WorkLocalJob = {
    id: ref.id,
    user_id: input.userId,
    device_id: input.deviceId ?? null,
    run_id: input.runId ?? null,
    job_type: input.jobType,
    status: "queued",
    payload: input.payload,
    result: null,
    error: null,
    created_at: now,
    updated_at: now,
    claimed_at: null,
    finished_at: null,
  };
  await ref.set(job);
  return job;
}

export async function pollLocalWorkJobs(
  db: Firestore,
  userId: string,
  deviceId: string,
  limit = 5
) {
  const device = await heartbeatPairedDevice(db, userId, deviceId);
  if (!device || device.status === "revoked") {
    return null;
  }

  const snapshot = await db
    .collection(COLLECTIONS.WORK_LOCAL_JOBS)
    .where("user_id", "==", userId)
    .where("status", "==", "queued")
    .get();
  const jobs = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as WorkLocalJob)
    .filter((job) => !job.device_id || job.device_id === deviceId)
    .sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))
    .slice(0, Math.min(Math.max(limit, 1), 20));
  const now = nowIso();

  for (const job of jobs) {
    await db.collection(COLLECTIONS.WORK_LOCAL_JOBS).doc(job.id).set(
      {
        status: "running",
        device_id: deviceId,
        claimed_at: now,
        updated_at: now,
      },
      { merge: true }
    );
  }

  return jobs.map((job) => ({
    ...job,
    status: "running" as const,
    device_id: deviceId,
    claimed_at: now,
    updated_at: now,
  }));
}

export async function finishLocalWorkJob(
  db: Firestore,
  userId: string,
  deviceId: string,
  jobId: string,
  input: { status?: string; result?: Record<string, unknown> | null; error?: string | null }
) {
  const ref = db.collection(COLLECTIONS.WORK_LOCAL_JOBS).doc(jobId);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!snapshot.exists || !data || data.user_id !== userId || data.device_id !== deviceId) {
    return null;
  }
  const status = input.status === "failed" || input.status === "canceled" ? input.status : "completed";
  const now = nowIso();
  await ref.set(
    {
      status,
      result: input.result ?? null,
      error: input.error ?? null,
      finished_at: now,
      updated_at: now,
    },
    { merge: true }
  );
  return { id: jobId, ...data, status, result: input.result ?? null, error: input.error ?? null };
}
