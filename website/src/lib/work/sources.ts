import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type WorkSourceCandidate,
  type WorkSourceProvider,
  type WorkSourceTask,
} from "@/lib/firebase/schema";
import { canAutoExecute, normalizeTrustedScope } from "./trusted";

export type SourceAdapter = {
  provider: WorkSourceProvider;
  label: string;
  officialCredentialKeys: string[];
  supportsBrowserFallback: boolean;
  resolveMode(): WorkSourceTask["mode"];
  run(query: string, task: WorkSourceTask): Promise<SourceRunResult>;
};

type SourceRunResult = {
  output: Record<string, unknown>;
  candidates: Array<Omit<WorkSourceCandidate, "id" | "user_id" | "task_id" | "created_at" | "updated_at">>;
};

type SourceCandidateListRecord = Record<string, unknown> & {
  id: string;
  created_at: string;
  updated_at: string;
};

const SOURCE_PROVIDERS: WorkSourceProvider[] = [
  "reddit",
  "tiktok",
  "alibaba",
  "aliexpress",
  "1688",
  "shopify",
  "youtube",
  "instagram",
  "facebook",
  "github",
  "web",
];

function nowIso() {
  return new Date().toISOString();
}

function readString(value: unknown, fallback = "", maxLength = 4000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function timestampToString(value: unknown): string {
  if (typeof value === "string" && value) return value;
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
        : nowIso();
    } catch {
      return nowIso();
    }
  }
  return nowIso();
}

function nullableTimestampToString(value: unknown) {
  if (!value) return null;
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
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function providerFromString(value: unknown): WorkSourceProvider | null {
  return typeof value === "string" && SOURCE_PROVIDERS.includes(value as WorkSourceProvider)
    ? (value as WorkSourceProvider)
    : null;
}

function hasEnv(...keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]));
}

function officialMode(keys: string[], fallback = true): WorkSourceTask["mode"] {
  if (keys.length > 0 && hasEnv(...keys)) return "official_api";
  return fallback ? "browser_fallback" : "existing_rearvy_data";
}

function buildBrowserSearchCandidate(provider: WorkSourceProvider, query: string) {
  const urls: Record<WorkSourceProvider, string> = {
    reddit: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`,
    tiktok: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
    alibaba: `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(query)}`,
    aliexpress: `https://www.aliexpress.com/w/wholesale-${encodeURIComponent(query)}.html`,
    "1688": `https://s.1688.com/selloffer/offer_search.htm?keywords=${encodeURIComponent(query)}`,
    shopify: `https://www.google.com/search?q=${encodeURIComponent(`site:myshopify.com ${query}`)}`,
    youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    instagram: `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(query)}`,
    facebook: `https://www.facebook.com/search/top?q=${encodeURIComponent(query)}`,
    github: `https://github.com/search?q=${encodeURIComponent(query)}`,
    web: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  };

  return {
    provider,
    title: `${provider} public research`,
    url: urls[provider],
    summary: "Approved browser-use fallback can inspect this public source and capture reusable evidence.",
    score: 0.6,
    price: null,
    moq: null,
    supplier: null,
    evidence: [
      {
        label: "Public source search",
        url: urls[provider],
        snippet: `Search query: ${query}`,
      },
    ],
    payload: { mode: "browser_fallback" },
  };
}

export function extractSupplierSignals(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  const priceMatch = normalized.match(/(?:US\s*)?\$\s?\d+(?:[.,]\d+)?(?:\s*-\s*(?:US\s*)?\$?\s?\d+(?:[.,]\d+)?)?/i);
  const moqMatch = normalized.match(/\b(?:MOQ|Min(?:imum)?\.?\s*Order)\s*:?\s*[\d,]+\s*(?:pieces|pcs|units|sets|pairs)?/i);
  const supplierMatch = normalized.match(/\b(?:supplier|seller|factory)\s*:?\s*([A-Z0-9][\w\s&.,'-]{2,80}?)(?=\s+(?:price|MOQ|Min(?:imum)?\.?\s*Order)|$)/i);
  return {
    price: priceMatch?.[0] || null,
    moq: moqMatch?.[0] || null,
    supplier: supplierMatch?.[1]?.trim() || null,
  };
}

async function runRedditOfficial(query: string): Promise<SourceRunResult> {
  if (!hasEnv("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET")) {
    return {
      output: { mode: "browser_fallback", note: "Reddit OAuth credentials are not configured." },
      candidates: [buildBrowserSearchCandidate("reddit", query)],
    };
  }

  const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT || "RearvyWorkPlatform/1.0",
    },
    body: "grant_type=client_credentials",
  });
  const tokenPayload = await tokenResponse.json().catch(() => null);
  const tokenRecord = isRecord(tokenPayload) ? tokenPayload : {};
  const accessToken =
    typeof tokenRecord.access_token === "string" ? tokenRecord.access_token : "";
  if (!tokenResponse.ok || !accessToken) {
    return {
      output: { mode: "official_api", error: "Reddit OAuth token request failed." },
      candidates: [],
    };
  }

  const searchResponse = await fetch(
    `https://oauth.reddit.com/search?q=${encodeURIComponent(query)}&limit=10&sort=relevance`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": process.env.REDDIT_USER_AGENT || "RearvyWorkPlatform/1.0",
      },
    }
  );
  const searchPayload = await searchResponse.json().catch(() => null);
  const searchRecord = isRecord(searchPayload) ? searchPayload : {};
  const searchData = isRecord(searchRecord.data) ? searchRecord.data : {};
  const children = Array.isArray(searchData.children)
    ? searchData.children
    : [];
  const candidates = children.map((child: unknown, index: number) => {
    const childRecord = isRecord(child) ? child : {};
    const data = isRecord(childRecord.data) ? childRecord.data : {};
    const permalink = readString(data.permalink, "");
    return {
      provider: "reddit" as const,
      title: readString(data.title, "Reddit result"),
      url: permalink ? `https://www.reddit.com${permalink}` : null,
      summary: readString(data.selftext, readString(data.subreddit_name_prefixed, ""), 500),
      score: Math.max(0.1, 1 - index * 0.08),
      price: null,
      moq: null,
      supplier: readString(data.subreddit_name_prefixed, "") || null,
      evidence: [
        {
          label: "Reddit API result",
          url: permalink ? `https://www.reddit.com${permalink}` : null,
          snippet: readString(data.title, ""),
        },
      ],
      payload: data,
    };
  });

  return {
    output: { mode: "official_api", resultCount: candidates.length },
    candidates,
  };
}

function shellOfficialResult(provider: WorkSourceProvider, query: string): SourceRunResult {
  const supplierSignals = extractSupplierSignals(query);
  return {
    output: {
      mode: "official_api",
      note: `${provider} credentials are configured. The adapter shell is ready for provider-specific API enrichment.`,
      query,
    },
    candidates: [
      {
        provider,
        title: `${provider} API research task`,
        url: null,
        summary: "Credentials are present; run enrichment through the provider API contract for this account.",
        score: 0.7,
        price: supplierSignals.price,
        moq: supplierSignals.moq,
        supplier: supplierSignals.supplier,
        evidence: [
          {
            label: "Configured official API",
            url: null,
            snippet: `${provider} credentials are available.`,
          },
        ],
        payload: { mode: "official_api" },
      },
    ],
  };
}

function makeAdapter(
  provider: WorkSourceProvider,
  label: string,
  officialCredentialKeys: string[],
  runOfficial?: (query: string, task: WorkSourceTask) => Promise<SourceRunResult> | SourceRunResult,
  supportsBrowserFallback = true
): SourceAdapter {
  return {
    provider,
    label,
    officialCredentialKeys,
    supportsBrowserFallback,
    resolveMode: () =>
      ["shopify", "youtube", "instagram", "facebook", "github"].includes(provider)
        ? "existing_rearvy_data"
        : officialMode(officialCredentialKeys, supportsBrowserFallback),
    run: async (query, task) => {
      if (task.mode === "official_api") {
        if (runOfficial) {
          return runOfficial(query, task);
        }
        return shellOfficialResult(provider, query);
      }

      if (task.mode === "existing_rearvy_data") {
        return {
          output: {
            mode: "existing_rearvy_data",
            note: `${provider} research uses existing Rearvy integrations and synced data first.`,
            query,
          },
          candidates: [
            {
              provider,
              title: `${provider} existing data scan`,
              url: null,
              summary: "Use synced Rearvy integration records as source evidence.",
              score: 0.65,
              price: null,
              moq: null,
              supplier: null,
              evidence: [
                {
                  label: "Rearvy integration data",
                  url: null,
                  snippet: `Search existing ${provider} records for ${query}.`,
                },
              ],
              payload: { mode: "existing_rearvy_data" },
            },
          ],
        };
      }

      const { createUnifiedBrowserSession } = await import("@/lib/browser-use/unifiedSessionManager");
      const browserTask = `Research ${provider} for "${query}". Capture supplier/source candidates, evidence links, prices or engagement signals when visible, and summarize findings.`;
      const session = await createUnifiedBrowserSession(browserTask, task.user_id, {
        connectionMethod: "auto",
      });
      return {
        output: session.ok
          ? {
              mode: "browser_fallback",
              browserSessionId: session.id,
              connectionMethod: session.connectionMethod ?? "auto",
              note: "Browser session started for approved public source research.",
            }
          : {
              mode: "browser_fallback",
              error: session.error,
              note: "Browser fallback could not start in this runtime.",
            },
        candidates: [buildBrowserSearchCandidate(provider, query)],
      };
    },
  };
}

const SOURCE_ADAPTERS: Record<WorkSourceProvider, SourceAdapter> = {
  reddit: makeAdapter("reddit", "Reddit", ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"], runRedditOfficial),
  tiktok: makeAdapter("tiktok", "TikTok", ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"]),
  alibaba: makeAdapter("alibaba", "Alibaba", ["ALIBABA_APP_KEY", "ALIBABA_APP_SECRET"]),
  aliexpress: makeAdapter("aliexpress", "AliExpress", ["ALIBABA_APP_KEY", "ALIBABA_APP_SECRET"]),
  "1688": makeAdapter("1688", "1688", ["ALIBABA_APP_KEY", "ALIBABA_APP_SECRET"]),
  shopify: makeAdapter("shopify", "Shopify", [], undefined, false),
  youtube: makeAdapter("youtube", "YouTube", [], undefined, false),
  instagram: makeAdapter("instagram", "Instagram", [], undefined, false),
  facebook: makeAdapter("facebook", "Facebook", [], undefined, false),
  github: makeAdapter("github", "GitHub", [], undefined, false),
  web: makeAdapter("web", "Public Web", [], undefined, true),
};

export function normalizeSourceTaskDocument(id: string, data: Record<string, unknown>): WorkSourceTask {
  const provider = providerFromString(data.provider) || "web";
  return {
    id,
    user_id: String(data.user_id || ""),
    provider,
    query: readString(data.query, ""),
    status:
      data.status === "awaiting_approval" ||
      data.status === "running" ||
      data.status === "completed" ||
      data.status === "failed" ||
      data.status === "canceled"
        ? data.status
        : "queued",
    mode:
      data.mode === "official_api" || data.mode === "existing_rearvy_data"
        ? data.mode
        : "browser_fallback",
    approval_required: Boolean(data.approval_required),
    auto_execute_enabled: Boolean(data.auto_execute_enabled),
    trusted_scope: normalizeTrustedScope(data.trusted_scope),
    last_auto_executed_at: readString(data.last_auto_executed_at, "") || null,
    agent_id: readString(data.agent_id, "") || null,
    team_id: readString(data.team_id, "") || null,
    run_id: readString(data.run_id, "") || null,
    output: isRecord(data.output) ? data.output : null,
    error: readString(data.error, "") || null,
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
    started_at: nullableTimestampToString(data.started_at),
    finished_at: nullableTimestampToString(data.finished_at),
  };
}

function normalizeSourceCandidateDocument(
  id: string,
  data: Record<string, unknown>
): SourceCandidateListRecord {
  return {
    ...data,
    id,
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
  };
}

export function getSourceCatalog() {
  return SOURCE_PROVIDERS.map((provider) => {
    const adapter = SOURCE_ADAPTERS[provider];
    const mode = adapter.resolveMode();
    return {
      provider,
      label: adapter.label,
      mode,
      status:
        mode === "official_api" || mode === "existing_rearvy_data"
          ? "ready"
          : "approval_required",
      officialCredentialKeys: adapter.officialCredentialKeys,
      browserFallback: adapter.supportsBrowserFallback,
    };
  });
}

export async function listSourceTasks(db: Firestore, userId: string, limit = 30) {
  const [tasksSnapshot, candidatesSnapshot] = await Promise.all([
    db.collection(COLLECTIONS.WORK_SOURCE_TASKS).where("user_id", "==", userId).get(),
    db.collection(COLLECTIONS.WORK_SOURCE_CANDIDATES).where("user_id", "==", userId).get(),
  ]);
  const tasks = tasksSnapshot.docs
    .map((doc) => normalizeSourceTaskDocument(doc.id, doc.data()))
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, limit);
  const candidates = candidatesSnapshot.docs
    .map((doc) => normalizeSourceCandidateDocument(doc.id, doc.data()))
    .sort((left, right) =>
      String(right.created_at).localeCompare(String(left.created_at))
    )
    .slice(0, limit);
  return { tasks, candidates };
}

export async function createSourceTask(
  db: Firestore,
  userId: string,
  input: Record<string, unknown>
) {
  const provider = providerFromString(input.provider) || "web";
  const query = readString(input.query, "", 1000);
  if (!query) {
    throw new Error("Source research query is required.");
  }

  const adapter = SOURCE_ADAPTERS[provider];
  const mode = adapter.resolveMode();
  const trustedScope = normalizeTrustedScope(input.trustedScope);
  const autoExecuteEnabled = Boolean(input.autoExecuteEnabled);
  const trustedAutoExecute = canAutoExecute({
    autoExecuteEnabled,
    trustedScope,
  });
  const approvalRequired = mode === "browser_fallback" && !trustedAutoExecute;
  const now = nowIso();
  const ref = db.collection(COLLECTIONS.WORK_SOURCE_TASKS).doc();
  const task: WorkSourceTask = {
    id: ref.id,
    user_id: userId,
    provider,
    query,
    status: approvalRequired ? "awaiting_approval" : "queued",
    mode,
    approval_required: approvalRequired,
    auto_execute_enabled: autoExecuteEnabled,
    trusted_scope: trustedScope,
    last_auto_executed_at: trustedAutoExecute ? now : null,
    agent_id: readString(input.agentId, "") || null,
    team_id: readString(input.teamId, "") || null,
    run_id: null,
    output: null,
    error: null,
    created_at: now,
    updated_at: now,
    started_at: null,
    finished_at: null,
  };
  await ref.set(task);

  if (!approvalRequired) {
    return runSourceTask(db, userId, task.id);
  }

  return task;
}

export async function getSourceTask(db: Firestore, userId: string, taskId: string) {
  const snapshot = await db.collection(COLLECTIONS.WORK_SOURCE_TASKS).doc(taskId).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data) return null;
  const task = normalizeSourceTaskDocument(snapshot.id, data);
  return task.user_id === userId ? task : null;
}

export async function runSourceTask(db: Firestore, userId: string, taskId: string) {
  const task = await getSourceTask(db, userId, taskId);
  if (!task) return null;
  if (task.status === "running") return task;
  if (task.status === "completed") return task;

  const ref = db.collection(COLLECTIONS.WORK_SOURCE_TASKS).doc(task.id);
  const startedAt = nowIso();
  await ref.set(
    {
      status: "running",
      approval_required: false,
      started_at: task.started_at || startedAt,
      updated_at: startedAt,
      error: null,
    },
    { merge: true }
  );

  try {
    const adapter = SOURCE_ADAPTERS[task.provider];
    const result = await adapter.run(task.query, { ...task, status: "running", approval_required: false });
    const batch = db.batch();
    const candidateRecords = result.candidates.map((candidate) => {
      const candidateRef = db.collection(COLLECTIONS.WORK_SOURCE_CANDIDATES).doc();
      const record: WorkSourceCandidate = {
        id: candidateRef.id,
        user_id: userId,
        task_id: task.id,
        provider: candidate.provider,
        title: candidate.title,
        url: candidate.url,
        summary: candidate.summary,
        score: candidate.score,
        evidence: candidate.evidence,
        price: candidate.price ?? null,
        moq: candidate.moq ?? null,
        supplier: candidate.supplier ?? null,
        payload: candidate.payload,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      batch.set(candidateRef, record);
      return record;
    });
    const artifactRef = db.collection(COLLECTIONS.WORK_ARTIFACTS).doc();
    const finishedAt = nowIso();
    batch.set(artifactRef, {
      user_id: userId,
      chat_id: null,
      agent_id: task.agent_id,
      team_id: task.team_id,
      run_id: task.run_id,
      source_task_id: task.id,
      title: `${SOURCE_ADAPTERS[task.provider].label} source research`,
      artifact_type: "source_research",
      payload: {
        ...result.output,
        candidates: candidateRecords,
      },
      created_at: finishedAt,
      updated_at: finishedAt,
    });
    batch.set(
      ref,
      {
        status: result.output.error ? "failed" : "completed",
        output: {
          ...result.output,
          artifactId: artifactRef.id,
          candidateCount: candidateRecords.length,
        },
        error: typeof result.output.error === "string" ? result.output.error : null,
        finished_at: finishedAt,
        updated_at: finishedAt,
      },
      { merge: true }
    );
    await batch.commit();

    return {
      ...task,
      status: result.output.error ? ("failed" as const) : ("completed" as const),
      output: {
        ...result.output,
        artifactId: artifactRef.id,
        candidateCount: candidateRecords.length,
      },
      finished_at: finishedAt,
      updated_at: finishedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source task failed.";
    const finishedAt = nowIso();
    await ref.set(
      {
        status: "failed",
        error: message.slice(0, 1000),
        finished_at: finishedAt,
        updated_at: finishedAt,
      },
      { merge: true }
    );
    throw error;
  }
}

export async function rejectSourceTask(db: Firestore, userId: string, taskId: string) {
  const task = await getSourceTask(db, userId, taskId);
  if (!task) return null;
  const now = nowIso();
  await db.collection(COLLECTIONS.WORK_SOURCE_TASKS).doc(task.id).set(
    {
      status: "canceled",
      error: "Rejected by user.",
      finished_at: now,
      updated_at: now,
    },
    { merge: true }
  );
  return { ...task, status: "canceled" as const, error: "Rejected by user.", updated_at: now };
}
