import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { saveMemoryRecord } from "@/lib/memory-store";
import { decrypt, encrypt } from "@/lib/utils/encryption";

type BrowserCredentialRecord = {
  id?: string;
  user_id?: string;
  project_id?: string | null;
  service?: string | null;
  label?: string | null;
  label_lower?: string | null;
  login_enc?: string | null;
  login_iv?: string | null;
  password_enc?: string | null;
  password_iv?: string | null;
  is_persistent?: boolean;
  is_active?: boolean;
  notes?: string | null;
  memory_id?: string | null;
  last_used_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BrowserCredentialListItem = {
  id: string;
  label: string;
  service: string;
  loginMask: string;
  isPersistent: boolean;
  projectId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastUsedAt: string | null;
};

export type BrowserCredentialSecret = {
  id: string;
  label: string;
  service: string;
  login: string;
  password: string;
  isPersistent: boolean;
  projectId: string | null;
};

type SaveBrowserCredentialInput = {
  adminDb: Firestore;
  userId: string;
  label: string;
  service: string;
  login: string;
  password: string;
  projectId?: string | null;
  notes?: string | null;
  persistent?: boolean;
  saveMemory?: boolean;
};

type SearchBrowserCredentialInput = {
  adminDb: Firestore;
  userId: string;
  query?: string;
  service?: string | null;
  projectId?: string | null;
  includeTransient?: boolean;
  limit?: number;
};

type ResolveBrowserCredentialInput = {
  adminDb: Firestore;
  userId: string;
  label: string;
  service?: string | null;
  projectId?: string | null;
};

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLower(value: string) {
  return collapseWhitespace(value).toLowerCase();
}

function normalizeService(service: string | null | undefined) {
  return service ? normalizeLower(service) : "general";
}

function sameProjectScope(
  leftProjectId: string | null | undefined,
  rightProjectId: string | null | undefined
) {
  return (leftProjectId ?? null) === (rightProjectId ?? null);
}

export function maskBrowserLogin(login: string) {
  const trimmed = collapseWhitespace(login);
  if (!trimmed) {
    return "hidden";
  }

  if (trimmed.includes("@")) {
    const [localPart, domainPart] = trimmed.split("@");
    const localMask =
      localPart.length <= 2
        ? `${localPart[0] ?? "*"}*`
        : `${localPart.slice(0, 2)}***`;
    const domainMask = domainPart
      ? domainPart.replace(/(^.).*?(\.[^.]+$)/, "$1***$2")
      : "***";
    return `${localMask}@${domainMask}`;
  }

  if (trimmed.length <= 3) {
    return `${trimmed[0] ?? "*"}**`;
  }

  return `${trimmed.slice(0, 3)}***`;
}

function createMemoryNote(label: string, service: string, loginMask: string) {
  return `Stored reusable browser credential "${label}" for ${service} (${loginMask}).`;
}

export async function saveBrowserCredentialRecord({
  adminDb,
  userId,
  label,
  service,
  login,
  password,
  projectId,
  notes,
  persistent = true,
  saveMemory = true,
}: SaveBrowserCredentialInput) {
  const normalizedLabel = collapseWhitespace(label);
  const normalizedLogin = collapseWhitespace(login);
  const normalizedPassword = collapseWhitespace(password);
  const normalizedService = normalizeService(service);

  if (!normalizedLabel) {
    throw new Error("Credential label is required.");
  }

  if (!normalizedLogin || !normalizedPassword) {
    throw new Error("Login and password are required.");
  }

  const snapshot = await adminDb
    .collection(COLLECTIONS.BROWSER_CREDENTIALS)
    .where("user_id", "==", userId)
    .get();

  const existingDoc = snapshot.docs.find((doc) => {
    const data = doc.data() as BrowserCredentialRecord;
    return (
      data.is_active !== false &&
      normalizeLower(data.label ?? "") === normalizeLower(normalizedLabel) &&
      normalizeService(data.service) === normalizedService &&
      sameProjectScope(data.project_id, projectId)
    );
  });

  const loginEncryption = encrypt(normalizedLogin);
  const passwordEncryption = encrypt(normalizedPassword);
  const nowIso = new Date().toISOString();

  let memoryId: string | null = null;
  if (persistent && saveMemory) {
    const memoryResult = await saveMemoryRecord({
      adminDb,
      userId,
      content: createMemoryNote(
        normalizedLabel,
        normalizedService,
        maskBrowserLogin(normalizedLogin)
      ),
      memoryType: "context",
      importance: 6,
      tags: ["browser-credential", normalizedService],
      projectId,
    });
    memoryId = memoryResult.id;
  }

  if (existingDoc) {
    await existingDoc.ref.update({
      label: normalizedLabel,
      label_lower: normalizeLower(normalizedLabel),
      service: normalizedService,
      login_enc: loginEncryption.encrypted,
      login_iv: loginEncryption.iv,
      password_enc: passwordEncryption.encrypted,
      password_iv: passwordEncryption.iv,
      is_persistent: persistent,
      is_active: true,
      notes: notes ? collapseWhitespace(notes) : null,
      updated_at: nowIso,
      ...(memoryId ? { memory_id: memoryId } : {}),
      ...(projectId ? { project_id: projectId } : {}),
    });

    return {
      id: existingDoc.id,
      label: normalizedLabel,
      service: normalizedService,
      loginMask: maskBrowserLogin(normalizedLogin),
      memorySaved: Boolean(memoryId),
      created: false,
      persistent,
    };
  }

  const docRef = adminDb.collection(COLLECTIONS.BROWSER_CREDENTIALS).doc();
  await docRef.set({
    id: docRef.id,
    user_id: userId,
    project_id: projectId ?? null,
    service: normalizedService,
    label: normalizedLabel,
    label_lower: normalizeLower(normalizedLabel),
    login_enc: loginEncryption.encrypted,
    login_iv: loginEncryption.iv,
    password_enc: passwordEncryption.encrypted,
    password_iv: passwordEncryption.iv,
    is_persistent: persistent,
    is_active: true,
    notes: notes ? collapseWhitespace(notes) : null,
    memory_id: memoryId,
    last_used_at: null,
    created_at: nowIso,
    updated_at: nowIso,
  });

  return {
    id: docRef.id,
    label: normalizedLabel,
    service: normalizedService,
    loginMask: maskBrowserLogin(normalizedLogin),
    memorySaved: Boolean(memoryId),
    created: true,
    persistent,
  };
}

export async function searchBrowserCredentials({
  adminDb,
  userId,
  query = "",
  service,
  projectId,
  includeTransient = false,
  limit = 5,
}: SearchBrowserCredentialInput): Promise<BrowserCredentialListItem[]> {
  const normalizedQuery = normalizeLower(query);
  const normalizedService = service ? normalizeService(service) : null;

  const snapshot = await adminDb
    .collection(COLLECTIONS.BROWSER_CREDENTIALS)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as BrowserCredentialRecord;
      if (data.is_active === false) {
        return null;
      }

      if (!includeTransient && data.is_persistent !== true) {
        return null;
      }

      if (
        normalizedService &&
        normalizeService(data.service) !== normalizedService
      ) {
        return null;
      }

      if (
        projectId &&
        !sameProjectScope(data.project_id, projectId) &&
        data.project_id
      ) {
        return null;
      }

      if (normalizedQuery) {
        const haystack = [
          data.label ?? "",
          data.service ?? "",
          data.notes ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedQuery)) {
          return null;
        }
      }

      if (!data.label || !data.login_enc || !data.login_iv) {
        return null;
      }

      let loginMask = "hidden";
      try {
        loginMask = maskBrowserLogin(
          decrypt(data.login_enc, data.login_iv)
        );
      } catch {
        loginMask = "stored";
      }

      return {
        id: doc.id,
        label: data.label,
        service: normalizeService(data.service),
        loginMask,
        isPersistent: data.is_persistent === true,
        projectId: data.project_id ?? null,
        createdAt: data.created_at ?? null,
        updatedAt: data.updated_at ?? null,
        lastUsedAt: data.last_used_at ?? null,
      } satisfies BrowserCredentialListItem;
    })
    .filter((item): item is BrowserCredentialListItem => Boolean(item))
    .sort((left, right) => {
      const leftTime = new Date(
        left.lastUsedAt ?? left.updatedAt ?? left.createdAt ?? 0
      ).getTime();
      const rightTime = new Date(
        right.lastUsedAt ?? right.updatedAt ?? right.createdAt ?? 0
      ).getTime();
      return rightTime - leftTime;
    })
    .slice(0, limit);
}

export async function resolveBrowserCredentialByLabel({
  adminDb,
  userId,
  label,
  service,
  projectId,
}: ResolveBrowserCredentialInput): Promise<BrowserCredentialSecret | null> {
  const normalizedLabel = normalizeLower(label);
  const normalizedService = service ? normalizeService(service) : null;

  const snapshot = await adminDb
    .collection(COLLECTIONS.BROWSER_CREDENTIALS)
    .where("user_id", "==", userId)
    .get();

  const candidates = snapshot.docs
    .map((doc) => ({
      id: doc.id,
      data: doc.data() as BrowserCredentialRecord,
    }))
    .filter(({ data }) => data.is_active !== false)
    .filter(({ data }) => normalizeLower(data.label ?? "") === normalizedLabel)
    .filter(({ data }) =>
      normalizedService
        ? normalizeService(data.service) === normalizedService
        : true
    )
    .sort((left, right) => {
      const leftScore = sameProjectScope(left.data.project_id, projectId) ? 1 : 0;
      const rightScore = sameProjectScope(right.data.project_id, projectId)
        ? 1
        : 0;
      return rightScore - leftScore;
    });

  const match = candidates[0];
  if (!match) {
    return null;
  }

  const { data } = match;
  if (
    !data.label ||
    !data.login_enc ||
    !data.login_iv ||
    !data.password_enc ||
    !data.password_iv
  ) {
    return null;
  }

  return {
    id: match.id,
    label: data.label,
    service: normalizeService(data.service),
    login: decrypt(data.login_enc, data.login_iv),
    password: decrypt(data.password_enc, data.password_iv),
    isPersistent: data.is_persistent === true,
    projectId: data.project_id ?? null,
  };
}

export async function touchBrowserCredentialUse(params: {
  adminDb: Firestore;
  credentialId: string;
}) {
  await params.adminDb
    .collection(COLLECTIONS.BROWSER_CREDENTIALS)
    .doc(params.credentialId)
    .update({
      last_used_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
}
