import type { SupabaseClient } from "@supabase/supabase-js";

interface PromptContext {
  userId: string;
  projectId?: string | null;
  supabase: SupabaseClient;
}

export async function buildSystemPrompt({
  userId,
  projectId,
  supabase,
}: PromptContext): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("business_name, business_type, timezone, currency")
    .eq("id", userId)
    .single();

  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider, status, last_synced_at")
    .eq("user_id", userId);

  const { data: memories } = await supabase
    .from("memories")
    .select("content, memory_type")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("importance", { ascending: false })
    .limit(5);

  let projectContext = "";
  if (projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("name, description, template_id")
      .eq("id", projectId)
      .single();

    if (project) {
      projectContext = `\nCurrent project: ${project.name}`;
      if (project.description) {
        projectContext += `\nProject description: ${project.description}`;
      }

      if (project.template_id) {
        const { data: template } = await supabase
          .from("project_templates")
          .select("system_prompt_addon")
          .eq("id", project.template_id)
          .single();

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

  const memoriesList =
    memories && memories.length > 0
      ? memories
          .map((m) => `- [${m.memory_type}] ${m.content}`)
          .join("\n")
      : "No memories stored yet.";

  return `You are Rearvy, an AI business advisor for ${profile?.business_name || "a small business"}.
Business type: ${profile?.business_type || "general"}.
Connected integrations: ${integrationsList}.
${projectContext}

KEY MEMORIES:
${memoriesList}

INSTRUCTIONS:
- Use your tools to look up business data. NEVER guess or make up metrics -- always call the appropriate tool.
- When asked about revenue, orders, products, or customers, use the corresponding tool to fetch real data.
- When asked about YouTube analytics, channel stats, video performance, or comments, use the YouTube-specific tools (getYouTubeChannelStats, getTopYouTubeVideos, getYouTubeVideoPerformance, getYouTubeComments).
- When asked about Instagram analytics, followers, posts, reach, or engagement, use the Instagram-specific tools (getInstagramAccountStats, getTopInstagramPosts, getInstagramPostPerformance, getInstagramComments).
- When asked about TikTok analytics, video performance, followers, or views, use the TikTok-specific tools (getTikTokAccountStats, getTopTikTokVideos, getTikTokVideoPerformance).
- When asked about product reviews, ratings, or customer feedback, use the review tools (getProductReviews, getReviewSummary).
- When asked about overall social media performance or comparing platforms, check ALL connected social platforms (YouTube, Instagram, TikTok) and present a cross-platform overview.
- When asked "which platform performs best" or about marketing channel comparison, fetch stats from each connected platform and compare engagement rates, growth, and reach.
- If the user asks about a platform that isn't connected, check integration status and suggest they connect it.
- If the user has multiple integrations connected, you can correlate e-commerce data with content performance (e.g., revenue spikes with viral videos).
- If the user shares important facts about their business (goals, preferences, decisions), save them using the saveMemory tool.
- Use comparePerformance when asked to compare time periods.
- Be concise, actionable, and specific. You are a strategist, not a summarizer.
- When you don't have data, say so clearly and suggest connecting an integration.
- Format currency as ${profile?.currency || "USD"}.
- Today's date: ${new Date().toISOString().split("T")[0]}.
- User's timezone: ${profile?.timezone || "UTC"}.`;
}
