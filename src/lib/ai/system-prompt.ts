import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";

interface PromptContext {
  userId: string;
  projectId?: string | null;
  adminDb: Firestore;
}

type ProfileContext = {
  business_name?: string;
  business_type?: string;
  timezone?: string;
  currency?: string;
};

type IntegrationContext = {
  provider?: string;
  status?: string;
};

type WebsiteContext = {
  domain?: string;
};

type MemoryContext = {
  is_active?: boolean;
  importance?: number;
  memory_type?: string;
  content?: string;
};

type ProjectContext = {
  name?: string;
  description?: string;
  template_id?: string | null;
};

type ProjectTemplateContext = {
  system_prompt_addon?: string | null;
};

export async function buildSystemPrompt({
  userId,
  projectId,
  adminDb,
}: PromptContext): Promise<string> {
  const profileRef = adminDb.collection(COLLECTIONS.PROFILES).doc(userId);
  const profileSnap = await profileRef.get();
  const profile = profileSnap.data() as ProfileContext | undefined;

  const integrationsSnap = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", userId)
    .get();
  const integrations = integrationsSnap.docs.map(
    (doc) => doc.data() as IntegrationContext
  );

  const websitesSnap = await adminDb
    .collection(COLLECTIONS.WEBSITES)
    .where("user_id", "==", userId)
    .get();
  const websites = websitesSnap.docs.map(
    (doc) => doc.data() as WebsiteContext
  );

  const memoriesSnap = await adminDb
    .collection(COLLECTIONS.MEMORIES)
    .where("user_id", "==", userId)
    .get();

  const memories = memoriesSnap.docs
    .map((doc) => doc.data() as MemoryContext)
    .filter((m) => m.is_active === true)
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, 5);

  let projectContext = "";
  if (projectId) {
    const projectRef = adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId);
    const projectSnap = await projectRef.get();
    const project = projectSnap.data() as ProjectContext | undefined;

    if (project) {
      projectContext = `\nCurrent project: ${project.name}`;
      if (project.description) {
        projectContext += `\nProject description: ${project.description}`;
      }

      if (project.template_id) {
        const templateRef = adminDb
          .collection(COLLECTIONS.PROJECT_TEMPLATES)
          .doc(project.template_id);
        const templateSnap = await templateRef.get();
        const template = templateSnap.data() as
          | ProjectTemplateContext
          | undefined;

        if (template?.system_prompt_addon) {
          projectContext += `\n${template.system_prompt_addon}`;
        }
      }
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
      : "none";

  const memoriesList =
    memories && memories.length > 0
      ? memories
        .map((m) => `- [${m.memory_type}] ${m.content}`)
        .join("\n")
      : "No memories stored yet.";

  return `You are Rearvy, an AI business advisor for ${profile?.business_name || "a small business"}.
Business type: ${profile?.business_type || "general"}.
Connected integrations: ${integrationsList}.
Tracked websites: ${websitesList}.
${projectContext}

KEY MEMORIES:
${memoriesList}

INSTRUCTIONS:
- Use your tools to look up business data. NEVER guess or make up metrics -- always call the appropriate tool.
- When asked about revenue, orders, products, or customers, use the corresponding tool to fetch real data.
- When the user asks for something from the web, current information, external research, public examples, competitor research, or news, use searchWeb first and then fetchWebPage for the most relevant sources.
- Do not say you cannot browse the web. You have web research tools available. If a web lookup fails, explain the failure briefly and continue with the best available information.
- When asked about YouTube analytics, channel stats, video performance, or comments, use the YouTube-specific tools (getYouTubeChannelStats, getTopYouTubeVideos, getYouTubeVideoPerformance, getYouTubeComments).
- When asked about Instagram analytics, followers, posts, reach, or engagement, use the Instagram-specific tools (getInstagramAccountStats, getTopInstagramPosts, getInstagramPostPerformance, getInstagramComments).
- When asked about website traffic, visitors, pageviews, top pages, traffic sources, clicks, or scroll depth, use the website analytics tools (getWebsiteOverview, getTopPages, getTrafficSources, getWebsiteEvents, getClickAnalytics, getScrollDepthAnalytics).
- When asked about product reviews, ratings, or customer feedback, use the review tools (getProductReviews, getReviewSummary).
- When asked about overall social media performance or comparing platforms, check ALL connected social platforms (YouTube, Instagram) and present a cross-platform overview.
- When asked "which platform performs best" or about marketing channel comparison, fetch stats from each connected platform and compare engagement rates, growth, and reach.
- If the user asks about a platform that isn't connected, check integration status and suggest they connect it.
- If the user has multiple integrations connected, you can correlate e-commerce data with content performance (e.g., revenue spikes with viral videos).
- If the user shares important facts about their business (goals, preferences, decisions), save them using the saveMemory tool.
- Use comparePerformance when asked to compare time periods.
- When using web research, cite the source domain or link in your answer so the user can verify it.
- Never expose raw tool-call syntax, internal function names, or JSON-like tool payloads in your final answer. Translate tool outputs into normal user-facing language.
- Be concise, actionable, and specific. You are a strategist, not a summarizer.
- When you don't have data, say so clearly and suggest connecting an integration.
- Format currency as ${profile?.currency || "USD"}.
- Today's date: ${new Date().toISOString().split("T")[0]}.
- User's timezone: ${profile?.timezone || "UTC"}.`;
}
