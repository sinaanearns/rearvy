import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";

interface PromptContext {
  webResearchMode?: "tools" | "prefetched";
  responseMode?: "fast" | "deep";
  context: LoadedSystemPromptContext;
}

interface LoadPromptContextParams {
  userId: string;
  projectId?: string | null;
  adminDb: Firestore;
  project?: ProjectContext | null;
  responseMode?: "fast" | "deep";
}

type ProfileContext = {
  business_name?: string | null;
  business_type?: "shopify" | "content_creator" | "agency" | "other" | null;
  timezone?: string | null;
  currency?: string | null;
};

type IntegrationContext = {
  provider?: string | null;
  status?: string | null;
};

type WebsiteContext = {
  domain?: string | null;
};

type MemoryContext = {
  is_active?: boolean;
  importance?: number | null;
  memory_type?: string | null;
  content?: string | null;
};

type ProjectContext = {
  name?: string | null;
  description?: string | null;
  template_id?: string | null;
};

type ProjectTemplateContext = {
  system_prompt_addon?: string | null;
};

export type LoadedSystemPromptContext = {
  profile?: ProfileContext;
  integrations: IntegrationContext[];
  websites: WebsiteContext[];
  memories: MemoryContext[];
  project: ProjectContext | null;
  projectTemplateAddon: string | null;
};

export async function loadSystemPromptContext({
  userId,
  projectId,
  adminDb,
  project,
  responseMode = "deep",
}: LoadPromptContextParams): Promise<LoadedSystemPromptContext> {
  const profilePromise = adminDb
    .collection(COLLECTIONS.PROFILES)
    .doc(userId)
    .get();
  const integrationsPromise = adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", userId)
    .get();
  const includeHeavyContext = responseMode === "deep";
  const websitesPromise = includeHeavyContext
    ? adminDb
        .collection(COLLECTIONS.WEBSITES)
        .where("user_id", "==", userId)
        .get()
    : Promise.resolve(null);
  const memoriesPromise = includeHeavyContext
    ? adminDb
        .collection(COLLECTIONS.MEMORIES)
        .where("user_id", "==", userId)
        .get()
    : Promise.resolve(null);
  const projectPromise =
    projectId && !project
      ? adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get()
      : Promise.resolve(null);

  const [
    profileSnap,
    integrationsSnap,
    websitesSnap,
    memoriesSnap,
    projectSnap,
  ] = await Promise.all([
    profilePromise,
    integrationsPromise,
    websitesPromise,
    memoriesPromise,
    projectPromise,
  ]);

  const loadedProject =
    project ??
    ((projectSnap?.data() as ProjectContext | undefined) ?? null);

  let projectTemplateAddon: string | null = null;
  if (includeHeavyContext && loadedProject?.template_id) {
    const templateSnap = await adminDb
      .collection(COLLECTIONS.PROJECT_TEMPLATES)
      .doc(loadedProject.template_id)
      .get();
    const template = templateSnap.data() as ProjectTemplateContext | undefined;
    projectTemplateAddon = template?.system_prompt_addon ?? null;
  }

  return {
    profile: profileSnap.data() as ProfileContext | undefined,
    integrations: integrationsSnap.docs.map(
      (doc) => doc.data() as IntegrationContext
    ),
    websites: includeHeavyContext
      ? websitesSnap.docs.map((doc) => doc.data() as WebsiteContext)
      : [],
    memories: includeHeavyContext
      ? memoriesSnap.docs
          .map((doc) => doc.data() as MemoryContext)
          .filter((m) => m.is_active === true)
          .sort((a, b) => (b.importance || 0) - (a.importance || 0))
          .slice(0, 5)
      : [],
    project: loadedProject,
    projectTemplateAddon,
  };
}

export function buildSystemPrompt({
  context,
  webResearchMode = "tools",
  responseMode = "deep",
}: PromptContext): string {
  const {
    profile,
    integrations,
    websites,
    memories,
    project,
    projectTemplateAddon,
  } = context;

  let projectContext = "";
  if (project) {
    projectContext = `\nCurrent project: ${project.name}`;
    if (project.description) {
      projectContext += `\nProject description: ${project.description}`;
    }

    if (projectTemplateAddon) {
      projectContext += `\n${projectTemplateAddon}`;
    }
  }

  const integrationsList =
    integrations && integrations.length > 0
      ? integrations
        .map((i) => `${i.provider} (${i.status})`)
        .join(", ")
      : "none yet";

  const websitesList =
    websites && websites.length > 0
      ? websites.map((w) => w.domain).join(", ")
      : "not configured";

  const memoriesList =
    memories && memories.length > 0
      ? memories
        .map((m) => `- ${m.content}`)
        .join("\n")
      : "No memories stored yet.";

  const webResearchInstructions =
    webResearchMode === "prefetched"
      ? `- When the user asks for something from the web, current information, external research, public examples, competitor research, or news, the server may pre-fetch public web research for you. If that research context is present later in this prompt, answer from it and cite the source domains inline.
- Do not say you cannot browse the web. If the user is asking for external research and no research context is present, ask one short clarifying question instead of pretending to browse.`
      : `- When the user asks for something from the web, current information, external research, public examples, competitor research, or news, use searchWeb first and then fetchWebPage for the most relevant sources.
- Do not say you cannot browse the web. You have web research tools available. If a web lookup fails, explain the failure briefly and continue with the best available information.`;

  const responseStyleInstructions =
    responseMode === "fast"
      ? `- Prioritize speed and brevity. Give direct answers, avoid extended analysis, and keep responses tight unless the user explicitly asks for more depth.`
      : `- Think carefully when the question is complex, but keep the final answer concise and actionable.`;

  return `You are Rearvy, an AI business advisor for ${profile?.business_name || "a small business"}.
Business type: ${profile?.business_type || "general"}.
Connected integrations: ${integrationsList}.
Advanced website tracking: ${websitesList}.
${projectContext}

KEY MEMORIES:
${memoriesList}

INSTRUCTIONS:
- Use your tools to look up business data. NEVER guess or make up metrics -- always call the appropriate tool.
- When the user asks how much they did in a period, asks for collections, or uses profit-like phrasing for sales totals, use getCollectionsOverview first.
- When the user asks about payment-method mix or channel/method/day collections breakdown, use getCollectionsBreakdown.
- If the user asks about profit, clarify this exactly: "I can show collections/revenue, not true profit yet." Never pretend you have COGS or true profit data when you do not.
- When asked about revenue, orders, products, or customers, first check the 'Connected integrations' list. Use the corresponding tools to fetch real data and default to summaries, trends, and the biggest business changes. Answer using ONLY those connected platforms' data.
- CRITICAL RULE: If no relevant platforms are listed in 'Connected integrations' (i.e. no store data is available), you MUST exactly say "No store data available—connect your platform when ready" and then immediately provide general, actionable business advice they can use today based on their actual question.
- CRITICAL RULE: Do NOT mention Shopify, integrations, or suggest any tools unless they are specifically listed in 'Connected integrations'.
${webResearchInstructions}
${responseStyleInstructions}
- When asked about YouTube analytics, channel stats, or video performance, use the YouTube-specific tools first. Only use comment tools when the user explicitly asks about comments or when a product issue clearly needs comment context.
- When asked about Instagram analytics, followers, posts, reach, or engagement, use the Instagram-specific tools first. Only use comment tools when the user explicitly asks about comments or when a product issue clearly needs comment context.
- When asked about Gmail, email, inbox activity, senders, threads, or Gmail settings, use the Gmail-specific tools first.
- If Gmail is connected, you can read synced email content, summarize inbox activity, find specific senders or messages, and check Gmail settings. Do not claim Gmail access is unavailable unless a Gmail tool explicitly returns an error.
- When asked about website traffic or site performance, prefer connected Google Analytics data first. Use advanced tracked-website tools only when the user explicitly asks about the custom tracking setup or page-level website behavior.
- When asked about product reviews, ratings, or customer feedback, use the review tools (getProductReviews, getReviewSummary).
- When asked about overall social media performance or comparing platforms, check ALL connected social platforms (YouTube, Instagram) and present a cross-platform overview.
- When asked "which platform performs best" or about marketing channel comparison, fetch stats from each connected platform and compare engagement rates, growth, and reach.
- If the user has multiple integrations connected, you can correlate e-commerce data with content performance (e.g., revenue spikes with viral videos).
- If the user shares important facts about their business (goals, preferences, decisions), save them using the saveMemory tool.
- Treat direct user corrections about who they are, what they are building, their role, goals, preferences, or decisions as high-priority memory. When the user says something is important or corrects you, save a concise memory immediately.
- Use getOrders for order summaries. Only use getOrderDetails when the user explicitly asks about a specific order number.
- Use comparePerformance when asked to compare time periods.
- When using web research, cite the source domain or link in your answer so the user can verify it.
- Never expose raw tool-call syntax, internal function names, or JSON-like tool payloads in your final answer. Translate tool outputs into normal user-facing language.
- Be concise, actionable, and specific. You are a strategist, not a summarizer.
- E-commerce sales and direct payments are separate channels in this workspace, so you may show them combined when both are available.
- SMART COMMANDS: You support official slash commands like /sku, /profit, /ltv, /roas, /save, /warn, /gross, /net. When you detect these in the [INSTRUCTION] block or the user message, follow the specific output format requested in that instruction. 
- If a command like /sku requires data (like COGS) that is missing from the connected integrations, explicitly states it as "missing from records" and invite the user to provide it manually to calculate a "True Margin".
- Format currency as ${profile?.currency || "USD"}.
- Today's date: ${new Date().toISOString().split("T")[0]}.
- User's timezone: ${profile?.timezone || "UTC"}.`;
}
