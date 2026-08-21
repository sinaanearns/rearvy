import "server-only";

import { randomUUID } from "crypto";
import type { DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  type CloudComputerFile,
  type CloudComputerFileType,
  type CloudComputerSession,
  type CloudComputerSessionStatus,
} from "@/lib/firebase/schema";
import { isCloudComputerRunningStatus } from "./types";

const ACTIVE_CLOUD_STATUSES: CloudComputerSessionStatus[] = [
  "initializing",
  "running",
  "awaiting_user",
];

function nowIso() {
  return new Date().toISOString();
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStatus(value: unknown): CloudComputerSessionStatus {
  switch (value) {
    case "initializing":
    case "running":
    case "awaiting_user":
    case "completed":
    case "failed":
    case "closed":
    case "login_required":
    case "timeout":
      return value;
    default:
      return "failed";
  }
}

function asFileType(value: unknown): CloudComputerFileType {
  switch (value) {
    case "upload":
    case "screenshot":
    case "evidence":
    case "download":
      return value;
    default:
      return "download";
  }
}

function normalizeSession(id: string, data: DocumentData): CloudComputerSession {
  return {
    id,
    user_id: asString(data.user_id),
    provider: "browserbase",
    provider_session_id: asString(data.provider_session_id),
    task: asString(data.task),
    status: asStatus(data.status),
    current_url: asNullableString(data.current_url),
    title: asNullableString(data.title),
    summary: asNullableString(data.summary),
    error: asNullableString(data.error),
    screenshot_storage_path: asNullableString(data.screenshot_storage_path),
    screenshot_url: asNullableString(data.screenshot_url),
    ttl_seconds:
      typeof data.ttl_seconds === "number" && Number.isFinite(data.ttl_seconds)
        ? data.ttl_seconds
        : 900,
    expires_at: asNullableString(data.expires_at),
    created_at: asString(data.created_at, nowIso()),
    updated_at: asString(data.updated_at, nowIso()),
    started_at: asNullableString(data.started_at),
    stopped_at: asNullableString(data.stopped_at),
  };
}

function normalizeFile(id: string, data: DocumentData): CloudComputerFile {
  return {
    id,
    user_id: asString(data.user_id),
    session_id: asString(data.session_id),
    provider_session_id: asString(data.provider_session_id),
    filename: asString(data.filename, "download"),
    type: asFileType(data.type),
    content_type: asNullableString(data.content_type),
    size_bytes: asNullableNumber(data.size_bytes),
    browserbase_download_id: asNullableString(data.browserbase_download_id),
    storage_path: asString(data.storage_path),
    download_url: asNullableString(data.download_url),
    created_at: asString(data.created_at, nowIso()),
  };
}

export async function createCloudComputerSessionRecord(params: {
  userId: string;
  providerSessionId: string;
  task: string;
  status?: CloudComputerSessionStatus;
  currentUrl?: string | null;
  title?: string | null;
  summary?: string | null;
  ttlSeconds: number;
  expiresAt?: string | null;
}) {
  const timestamp = nowIso();
  const id = `cc_${randomUUID()}`;
  const session: CloudComputerSession = {
    id,
    user_id: params.userId,
    provider: "browserbase",
    provider_session_id: params.providerSessionId,
    task: params.task,
    status: params.status || "running",
    current_url: params.currentUrl ?? null,
    title: params.title ?? null,
    summary: params.summary ?? null,
    error: null,
    screenshot_storage_path: null,
    screenshot_url: null,
    ttl_seconds: params.ttlSeconds,
    expires_at: params.expiresAt ?? null,
    created_at: timestamp,
    updated_at: timestamp,
    started_at: timestamp,
    stopped_at: null,
  };

  await adminDb.collection(COLLECTIONS.CLOUD_COMPUTER_SESSIONS).doc(id).set(session);
  return session;
}

export async function getCloudComputerSession(id: string) {
  const snapshot = await adminDb
    .collection(COLLECTIONS.CLOUD_COMPUTER_SESSIONS)
    .doc(id)
    .get();
  if (!snapshot.exists) return null;
  return normalizeSession(snapshot.id, snapshot.data() || {});
}

export async function listCloudComputerSessions(userId: string) {
  const snapshot = await adminDb
    .collection(COLLECTIONS.CLOUD_COMPUTER_SESSIONS)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs
    .map((doc) => normalizeSession(doc.id, doc.data()))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
}

export async function listActiveCloudComputerSessions(userId: string) {
  const sessions = await listCloudComputerSessions(userId);
  return sessions.filter((session) => isCloudComputerRunningStatus(session.status));
}

export async function updateCloudComputerSession(
  id: string,
  updates: Partial<Omit<CloudComputerSession, "id" | "user_id" | "provider" | "provider_session_id" | "created_at">>
) {
  const cleanUpdates = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined)
  );

  await adminDb
    .collection(COLLECTIONS.CLOUD_COMPUTER_SESSIONS)
    .doc(id)
    .set(
      {
        ...cleanUpdates,
        updated_at: nowIso(),
      },
      { merge: true }
    );

  return getCloudComputerSession(id);
}

export async function closeCloudComputerSessionRecord(id: string, status: CloudComputerSessionStatus) {
  return updateCloudComputerSession(id, {
    status,
    stopped_at: nowIso(),
  });
}

export async function createCloudComputerFileRecord(params: {
  userId: string;
  sessionId: string;
  providerSessionId: string;
  filename: string;
  type: CloudComputerFileType;
  contentType?: string | null;
  sizeBytes?: number | null;
  browserbaseDownloadId?: string | null;
  storagePath: string;
  downloadUrl?: string | null;
}) {
  const id = `ccf_${randomUUID()}`;
  const file: CloudComputerFile = {
    id,
    user_id: params.userId,
    session_id: params.sessionId,
    provider_session_id: params.providerSessionId,
    filename: params.filename,
    type: params.type,
    content_type: params.contentType ?? null,
    size_bytes: params.sizeBytes ?? null,
    browserbase_download_id: params.browserbaseDownloadId ?? null,
    storage_path: params.storagePath,
    download_url: params.downloadUrl ?? null,
    created_at: nowIso(),
  };

  await adminDb.collection(COLLECTIONS.CLOUD_COMPUTER_FILES).doc(id).set(file);
  return file;
}

export async function listCloudComputerFiles(sessionId: string, userId: string) {
  const snapshot = await adminDb
    .collection(COLLECTIONS.CLOUD_COMPUTER_FILES)
    .where("session_id", "==", sessionId)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs
    .map((doc) => normalizeFile(doc.id, doc.data()))
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
}

export function getActiveCloudStatuses() {
  return [...ACTIVE_CLOUD_STATUSES];
}
