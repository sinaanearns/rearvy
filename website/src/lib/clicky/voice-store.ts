import "server-only";

import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  DEFAULT_CLICKY_VOICE_PROFILE,
  getDictionaryKeyterms,
  normalizeVoiceProfile,
  type ClickyVoiceDictionaryEntry,
  type ClickyVoiceProfile,
  type ClickyVoiceScope,
  type ClickyVoiceSnippet,
  type ClickyVoiceStyle,
  type ClickyVoiceTeam,
  type ClickyVoiceTeamMember,
  type ClickyVoiceTeamMemberRole,
  type ClickyVoiceTeamSettings,
} from "@/lib/clicky/voice-core";

export type ClickyVoiceContext = {
  profile: ClickyVoiceProfile;
  dictionary: ClickyVoiceDictionaryEntry[];
  snippets: ClickyVoiceSnippet[];
  styles: ClickyVoiceStyle[];
  teams: ClickyVoiceTeam[];
  memberships: ClickyVoiceTeamMember[];
  keyterms: string[];
};

export type ClickyVoiceUsageSummary = {
  totalEvents: number;
  totalWords: number;
  totalDurationMs: number;
  byApp: Array<{ appName: string; events: number; words: number }>;
  recent: Array<Record<string, unknown>>;
};

const DEFAULT_TEAM_SETTINGS: ClickyVoiceTeamSettings = {
  contextAwarenessEnabled: true,
  retentionMode: "off",
  usageAnalyticsVisible: true,
};

function nowIso() {
  return new Date().toISOString();
}

function readString(value: unknown, fallback = "", maxLength = 1000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function readStringArray(value: unknown, maxItems = 100) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, maxItems);
}

function normalizeScope(value: unknown): ClickyVoiceScope {
  return value === "team" ? "team" : "personal";
}

function normalizeRole(value: unknown): ClickyVoiceTeamMemberRole {
  if (value === "owner" || value === "admin") {
    return value;
  }
  return "member";
}

function normalizeTeamSettings(value: unknown): ClickyVoiceTeamSettings {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const retentionMode =
    record.retentionMode === "metadata" || record.retention_mode === "metadata"
      ? "metadata"
      : record.retentionMode === "transcripts" || record.retention_mode === "transcripts"
        ? "transcripts"
        : "off";

  return {
    contextAwarenessEnabled:
      typeof record.contextAwarenessEnabled === "boolean"
        ? record.contextAwarenessEnabled
        : typeof record.context_awareness_enabled === "boolean"
          ? record.context_awareness_enabled
          : DEFAULT_TEAM_SETTINGS.contextAwarenessEnabled,
    retentionMode,
    usageAnalyticsVisible:
      typeof record.usageAnalyticsVisible === "boolean"
        ? record.usageAnalyticsVisible
        : typeof record.usage_analytics_visible === "boolean"
          ? record.usage_analytics_visible
          : DEFAULT_TEAM_SETTINGS.usageAnalyticsVisible,
  };
}

function mapDictionaryDoc(id: string, data: Record<string, unknown>): ClickyVoiceDictionaryEntry {
  return {
    id,
    userId: readString(data.user_id || data.userId),
    teamId: readString(data.team_id || data.teamId) || null,
    scope: normalizeScope(data.scope),
    spoken: readString(data.spoken, "", 200),
    replacement: readString(data.replacement, "", 200),
    keyterms: readStringArray(data.keyterms, 80),
    priority: Number.isFinite(Number(data.priority)) ? Number(data.priority) : 0,
    enabled: data.enabled !== false,
    createdAt: readString(data.created_at || data.createdAt),
    updatedAt: readString(data.updated_at || data.updatedAt),
  };
}

function mapSnippetDoc(id: string, data: Record<string, unknown>): ClickyVoiceSnippet {
  return {
    id,
    userId: readString(data.user_id || data.userId),
    teamId: readString(data.team_id || data.teamId) || null,
    scope: normalizeScope(data.scope),
    trigger: readString(data.trigger, "", 200),
    expansion: readString(data.expansion, "", 4000),
    priority: Number.isFinite(Number(data.priority)) ? Number(data.priority) : 0,
    enabled: data.enabled !== false,
    createdAt: readString(data.created_at || data.createdAt),
    updatedAt: readString(data.updated_at || data.updatedAt),
  };
}

function mapStyleDoc(id: string, data: Record<string, unknown>): ClickyVoiceStyle {
  const category = readString(data.category, "default");
  return {
    id,
    userId: readString(data.user_id || data.userId),
    teamId: readString(data.team_id || data.teamId) || null,
    scope: normalizeScope(data.scope),
    name: readString(data.name, "Style", 120),
    category:
      category === "email" ||
      category === "chat" ||
      category === "docs" ||
      category === "code" ||
      category === "terminal" ||
      category === "browser"
        ? category
        : "default",
    instructions: readString(data.instructions, "", 1000),
    enabled: data.enabled !== false,
    createdAt: readString(data.created_at || data.createdAt),
    updatedAt: readString(data.updated_at || data.updatedAt),
  };
}

function mapTeamDoc(id: string, data: Record<string, unknown>): ClickyVoiceTeam {
  return {
    id,
    ownerId: readString(data.owner_id || data.ownerId),
    name: readString(data.name, "Clicky Team", 160),
    settings: normalizeTeamSettings(data.settings),
    createdAt: readString(data.created_at || data.createdAt),
    updatedAt: readString(data.updated_at || data.updatedAt),
  };
}

function mapMemberDoc(id: string, data: Record<string, unknown>): ClickyVoiceTeamMember {
  return {
    id,
    teamId: readString(data.team_id || data.teamId),
    userId: readString(data.user_id || data.userId),
    email: readString(data.email, "", 240) || null,
    role: normalizeRole(data.role),
    createdAt: readString(data.created_at || data.createdAt),
    updatedAt: readString(data.updated_at || data.updatedAt),
  };
}

export async function getVoiceProfile(db: Firestore, userId: string) {
  const snap = await db.collection(COLLECTIONS.CLICKY_VOICE_PROFILES).doc(userId).get();
  const data = snap.data() || {};
  return normalizeVoiceProfile(userId, {
    shortcut: readString(data.shortcut, DEFAULT_CLICKY_VOICE_PROFILE.shortcut),
    commandShortcut: readString(data.command_shortcut || data.commandShortcut, DEFAULT_CLICKY_VOICE_PROFILE.commandShortcut),
    commandModeEnabled: data.command_mode_enabled !== false && data.commandModeEnabled !== false,
    contextAwarenessEnabled: data.context_awareness_enabled !== false && data.contextAwarenessEnabled !== false,
    pressEnterEnabled: data.press_enter_enabled !== false && data.pressEnterEnabled !== false,
    languageMode:
      data.language_mode === "english" || data.languageMode === "english"
        ? "english"
        : data.language_mode === "multilingual" || data.languageMode === "multilingual"
          ? "multilingual"
          : "auto",
    retentionMode:
      data.retention_mode === "metadata" || data.retentionMode === "metadata"
        ? "metadata"
        : data.retention_mode === "transcripts" || data.retentionMode === "transcripts"
          ? "transcripts"
          : "off",
    usageAnalyticsVisible: data.usage_analytics_visible !== false && data.usageAnalyticsVisible !== false,
    styleDefaults:
      data.style_defaults && typeof data.style_defaults === "object"
        ? (data.style_defaults as ClickyVoiceProfile["styleDefaults"])
        : data.styleDefaults && typeof data.styleDefaults === "object"
          ? (data.styleDefaults as ClickyVoiceProfile["styleDefaults"])
          : {},
    createdAt: readString(data.created_at || data.createdAt),
    updatedAt: readString(data.updated_at || data.updatedAt),
  });
}

export async function updateVoiceProfile(
  db: Firestore,
  userId: string,
  patch: Partial<ClickyVoiceProfile>
) {
  const current = await getVoiceProfile(db, userId);
  const next = normalizeVoiceProfile(userId, { ...current, ...patch, updatedAt: nowIso() });
  const ref = db.collection(COLLECTIONS.CLICKY_VOICE_PROFILES).doc(userId);
  const createdAt = current.createdAt || nowIso();
  await ref.set(
    {
      user_id: userId,
      shortcut: next.shortcut,
      command_shortcut: next.commandShortcut,
      command_mode_enabled: next.commandModeEnabled,
      context_awareness_enabled: next.contextAwarenessEnabled,
      press_enter_enabled: next.pressEnterEnabled,
      language_mode: next.languageMode,
      retention_mode: next.retentionMode,
      usage_analytics_visible: next.usageAnalyticsVisible,
      style_defaults: next.styleDefaults,
      created_at: createdAt,
      updated_at: next.updatedAt,
    },
    { merge: true }
  );

  return { ...next, createdAt };
}

export async function listVoiceMemberships(db: Firestore, userId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.CLICKY_VOICE_TEAM_MEMBERS)
    .where("user_id", "==", userId)
    .get();

  return snapshot.docs.map((doc) => mapMemberDoc(doc.id, doc.data()));
}

export async function listVoiceTeams(db: Firestore, userId: string) {
  const [ownedSnapshot, memberships] = await Promise.all([
    db.collection(COLLECTIONS.CLICKY_VOICE_TEAMS).where("owner_id", "==", userId).get(),
    listVoiceMemberships(db, userId),
  ]);

  const teams = new Map<string, ClickyVoiceTeam>();
  for (const doc of ownedSnapshot.docs) {
    teams.set(doc.id, mapTeamDoc(doc.id, doc.data()));
  }

  await Promise.all(
    memberships.map(async (membership) => {
      if (!membership.teamId || teams.has(membership.teamId)) return;
      const snap = await db.collection(COLLECTIONS.CLICKY_VOICE_TEAMS).doc(membership.teamId).get();
      if (snap.exists) {
        teams.set(snap.id, mapTeamDoc(snap.id, snap.data() || {}));
      }
    })
  );

  return Array.from(teams.values()).sort((left, right) =>
    String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
  );
}

export async function getVoiceTeamAccess(db: Firestore, teamId: string, userId: string) {
  const teamSnap = await db.collection(COLLECTIONS.CLICKY_VOICE_TEAMS).doc(teamId).get();
  if (!teamSnap.exists) {
    return null;
  }

  const team = mapTeamDoc(teamSnap.id, teamSnap.data() || {});
  if (team.ownerId === userId) {
    return { team, role: "owner" as ClickyVoiceTeamMemberRole, canManage: true };
  }

  const memberSnapshot = await db
    .collection(COLLECTIONS.CLICKY_VOICE_TEAM_MEMBERS)
    .where("team_id", "==", teamId)
    .where("user_id", "==", userId)
    .limit(1)
    .get();

  const memberDoc = memberSnapshot.docs[0];
  if (!memberDoc) {
    return null;
  }

  const member = mapMemberDoc(memberDoc.id, memberDoc.data());
  return {
    team,
    role: member.role,
    canManage: member.role === "owner" || member.role === "admin",
  };
}

export async function createVoiceTeam(db: Firestore, userId: string, name: string, email: string | null) {
  const ref = db.collection(COLLECTIONS.CLICKY_VOICE_TEAMS).doc();
  const memberRef = db.collection(COLLECTIONS.CLICKY_VOICE_TEAM_MEMBERS).doc();
  const now = nowIso();
  const team = {
    owner_id: userId,
    name: readString(name, "Clicky Team", 160),
    settings: DEFAULT_TEAM_SETTINGS,
    created_at: now,
    updated_at: now,
  };

  const batch = db.batch();
  batch.set(ref, team);
  batch.set(memberRef, {
    team_id: ref.id,
    user_id: userId,
    email,
    role: "owner",
    created_at: now,
    updated_at: now,
  });
  await batch.commit();

  return mapTeamDoc(ref.id, team);
}

export async function getVoiceContext(db: Firestore, userId: string): Promise<ClickyVoiceContext> {
  const [profile, memberships, personalDictionary, personalSnippets, personalStyles] = await Promise.all([
    getVoiceProfile(db, userId),
    listVoiceMemberships(db, userId),
    db.collection(COLLECTIONS.CLICKY_VOICE_DICTIONARY).where("user_id", "==", userId).where("scope", "==", "personal").get(),
    db.collection(COLLECTIONS.CLICKY_VOICE_SNIPPETS).where("user_id", "==", userId).where("scope", "==", "personal").get(),
    db.collection(COLLECTIONS.CLICKY_VOICE_STYLES).where("user_id", "==", userId).where("scope", "==", "personal").get(),
  ]);

  const teamIds = Array.from(new Set(memberships.map((membership) => membership.teamId).filter(Boolean)));
  const [teams, teamDictionary, teamSnippets, teamStyles] = await Promise.all([
    listVoiceTeams(db, userId),
    Promise.all(
      teamIds.map((teamId) =>
        db.collection(COLLECTIONS.CLICKY_VOICE_DICTIONARY).where("team_id", "==", teamId).where("scope", "==", "team").get()
      )
    ),
    Promise.all(
      teamIds.map((teamId) =>
        db.collection(COLLECTIONS.CLICKY_VOICE_SNIPPETS).where("team_id", "==", teamId).where("scope", "==", "team").get()
      )
    ),
    Promise.all(
      teamIds.map((teamId) =>
        db.collection(COLLECTIONS.CLICKY_VOICE_STYLES).where("team_id", "==", teamId).where("scope", "==", "team").get()
      )
    ),
  ]);

  const dictionary = [
    ...personalDictionary.docs.map((doc) => mapDictionaryDoc(doc.id, doc.data())),
    ...teamDictionary.flatMap((snapshot) => snapshot.docs.map((doc) => mapDictionaryDoc(doc.id, doc.data()))),
  ];
  const snippets = [
    ...personalSnippets.docs.map((doc) => mapSnippetDoc(doc.id, doc.data())),
    ...teamSnippets.flatMap((snapshot) => snapshot.docs.map((doc) => mapSnippetDoc(doc.id, doc.data()))),
  ];
  const styles = [
    ...personalStyles.docs.map((doc) => mapStyleDoc(doc.id, doc.data())),
    ...teamStyles.flatMap((snapshot) => snapshot.docs.map((doc) => mapStyleDoc(doc.id, doc.data()))),
  ];

  return {
    profile,
    dictionary,
    snippets,
    styles,
    teams,
    memberships,
    keyterms: getDictionaryKeyterms(dictionary),
  };
}

export async function createDictionaryEntry(
  db: Firestore,
  userId: string,
  input: Record<string, unknown>
) {
  const now = nowIso();
  const scope = normalizeScope(input.scope);
  const ref = db.collection(COLLECTIONS.CLICKY_VOICE_DICTIONARY).doc();
  const entry = {
    user_id: userId,
    team_id: scope === "team" ? readString(input.teamId || input.team_id, "", 200) || null : null,
    scope,
    spoken: readString(input.spoken, "", 200),
    replacement: readString(input.replacement, "", 200),
    keyterms: readStringArray(input.keyterms, 80),
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    enabled: input.enabled !== false,
    created_at: now,
    updated_at: now,
  };

  await ref.set(entry);
  return mapDictionaryDoc(ref.id, entry);
}

export async function createSnippet(
  db: Firestore,
  userId: string,
  input: Record<string, unknown>
) {
  const now = nowIso();
  const scope = normalizeScope(input.scope);
  const ref = db.collection(COLLECTIONS.CLICKY_VOICE_SNIPPETS).doc();
  const snippet = {
    user_id: userId,
    team_id: scope === "team" ? readString(input.teamId || input.team_id, "", 200) || null : null,
    scope,
    trigger: readString(input.trigger, "", 200),
    expansion: readString(input.expansion, "", 4000),
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    enabled: input.enabled !== false,
    created_at: now,
    updated_at: now,
  };

  await ref.set(snippet);
  return mapSnippetDoc(ref.id, snippet);
}

export async function createStyle(
  db: Firestore,
  userId: string,
  input: Record<string, unknown>
) {
  const now = nowIso();
  const scope = normalizeScope(input.scope);
  const category = readString(input.category, "default", 40);
  const ref = db.collection(COLLECTIONS.CLICKY_VOICE_STYLES).doc();
  const style = {
    user_id: userId,
    team_id: scope === "team" ? readString(input.teamId || input.team_id, "", 200) || null : null,
    scope,
    name: readString(input.name, "Style", 120),
    category,
    instructions: readString(input.instructions, "", 1000),
    enabled: input.enabled !== false,
    created_at: now,
    updated_at: now,
  };

  await ref.set(style);
  return mapStyleDoc(ref.id, style);
}

export async function updateVoiceResource(
  db: Firestore,
  collection: string,
  id: string,
  userId: string,
  patch: Record<string, unknown>
) {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || !data) {
    return null;
  }

  const teamId = readString(data.team_id || data.teamId, "", 200);
  const ownsResource = data.user_id === userId;
  const teamAccess = ownsResource || !teamId ? null : await getVoiceTeamAccess(db, teamId, userId);
  if (!ownsResource && !teamAccess?.canManage) {
    return null;
  }

  const allowedPatch: Record<string, unknown> = {
    ...patch,
    updated_at: nowIso(),
  };
  delete allowedPatch.id;
  delete allowedPatch.user_id;
  delete allowedPatch.userId;
  delete allowedPatch.created_at;
  delete allowedPatch.createdAt;

  await ref.set(allowedPatch, { merge: true });
  const next = { ...data, ...allowedPatch };
  if (collection === COLLECTIONS.CLICKY_VOICE_DICTIONARY) return mapDictionaryDoc(id, next);
  if (collection === COLLECTIONS.CLICKY_VOICE_SNIPPETS) return mapSnippetDoc(id, next);
  if (collection === COLLECTIONS.CLICKY_VOICE_STYLES) return mapStyleDoc(id, next);
  return { id, ...next };
}

export async function deleteVoiceResource(db: Firestore, collection: string, id: string, userId: string) {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  const data = snap.data();
  if (!snap.exists || !data) {
    return false;
  }

  const teamId = readString(data.team_id || data.teamId, "", 200);
  const ownsResource = data.user_id === userId;
  const teamAccess = ownsResource || !teamId ? null : await getVoiceTeamAccess(db, teamId, userId);
  if (!ownsResource && !teamAccess?.canManage) {
    return false;
  }

  await ref.delete();
  return true;
}

export async function recordVoiceUsage(
  db: Firestore,
  userId: string,
  input: Record<string, unknown>
) {
  const now = nowIso();
  const text = readString(input.text, "", 20_000);
  const wordCount =
    Number.isFinite(Number(input.wordCount))
      ? Math.max(0, Math.round(Number(input.wordCount)))
      : text.split(/\s+/).filter(Boolean).length;
  const ref = db.collection(COLLECTIONS.CLICKY_VOICE_USAGE_EVENTS).doc();
  const event = {
    user_id: userId,
    team_id: readString(input.teamId || input.team_id, "", 200) || null,
    mode: readString(input.mode, "dictation", 40),
    app_name: readString(input.appName || input.app_name, "Unknown app", 160),
    category: readString(input.category, "default", 40),
    word_count: wordCount,
    duration_ms: Number.isFinite(Number(input.durationMs || input.duration_ms))
      ? Math.max(0, Math.round(Number(input.durationMs || input.duration_ms)))
      : 0,
    retained_transcript: input.retainedTranscript || input.retained_transcript || null,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    created_at: now,
  };

  await ref.set(event);
  return { id: ref.id, ...event };
}

export async function getVoiceUsageSummary(db: Firestore, userId: string): Promise<ClickyVoiceUsageSummary> {
  const snapshot = await db
    .collection(COLLECTIONS.CLICKY_VOICE_USAGE_EVENTS)
    .where("user_id", "==", userId)
    .get();
  const events = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((left, right) =>
      String((right as { created_at?: unknown }).created_at || "").localeCompare(
        String((left as { created_at?: unknown }).created_at || "")
      )
    );
  const byApp = new Map<string, { appName: string; events: number; words: number }>();
  let totalWords = 0;
  let totalDurationMs = 0;

  for (const event of events) {
    const record = event as Record<string, unknown>;
    const appName = readString(record.app_name, "Unknown app", 160);
    const words = Number.isFinite(Number(record.word_count)) ? Number(record.word_count) : 0;
    const duration = Number.isFinite(Number(record.duration_ms)) ? Number(record.duration_ms) : 0;
    const app = byApp.get(appName) || { appName, events: 0, words: 0 };
    app.events += 1;
    app.words += words;
    byApp.set(appName, app);
    totalWords += words;
    totalDurationMs += duration;
  }

  return {
    totalEvents: events.length,
    totalWords,
    totalDurationMs,
    byApp: Array.from(byApp.values()).sort((left, right) => right.words - left.words).slice(0, 10),
    recent: events.slice(0, 25),
  };
}
