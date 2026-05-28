import { performWebSearch, type PublicWebSearchResult } from "@/lib/ai/tools/web";

export type ImageGenerationWebSearch = {
  ok: boolean;
  query: string;
  searchedAt: string;
  results: PublicWebSearchResult[];
  message?: string;
};

export type ImagePromptResearchResult = {
  prompt: string;
  webSearch: ImageGenerationWebSearch | null;
};

function isImageWebSearchEnabled() {
  const value = process.env.IMAGE_GENERATION_WEB_SEARCH?.trim().toLowerCase();
  return !["0", "false", "off", "disabled"].includes(value || "");
}

function getImageWebSearchLimit() {
  const parsed = Number(process.env.IMAGE_GENERATION_WEB_SEARCH_LIMIT?.trim());
  return Number.isFinite(parsed)
    ? Math.min(5, Math.max(1, Math.round(parsed)))
    : 3;
}

function buildImageSearchQuery(prompt: string) {
  return prompt
    .replace(/\bAvoid rendered text[\s\S]*$/i, "")
    .replace(/\bA clear image of\b/i, "")
    .replace(/[^\w\s"'().:/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function getImageWebResearch(prompt: string) {
  if (!isImageWebSearchEnabled()) {
    return null;
  }

  const query = buildImageSearchQuery(prompt);
  if (query.length < 2) {
    return null;
  }

  try {
    const result = await performWebSearch(query, getImageWebSearchLimit());
    return {
      ok: result.ok,
      query: result.query,
      searchedAt: result.searchedAt,
      message: result.message,
      results: result.results,
    } satisfies ImageGenerationWebSearch;
  } catch (error) {
    return {
      ok: false,
      query,
      searchedAt: new Date().toISOString(),
      message:
        error instanceof Error
          ? error.message
          : "Web search failed before image generation.",
      results: [],
    } satisfies ImageGenerationWebSearch;
  }
}

function buildPromptWithWebResearch(
  prompt: string,
  webSearch: ImageGenerationWebSearch | null
) {
  const results = webSearch?.results?.slice(0, getImageWebSearchLimit()) ?? [];
  if (results.length === 0) {
    return prompt;
  }

  const notes = results
    .map((result) => {
      const title = result.title || result.source || "Source";
      const snippet = result.snippet || "No snippet available.";
      return `- ${title} (${result.source}): ${snippet}`;
    })
    .join("\n");

  return [
    prompt,
    "",
    "Use these current web-search notes only for factual visual details and context:",
    notes,
    "",
    "Do not render source text, URLs, watermarks, citations, labels, or UI unless the user explicitly requested visible text.",
  ].join("\n");
}

export async function enrichImagePromptWithWebResearch(
  prompt: string
): Promise<ImagePromptResearchResult> {
  const webSearch = await getImageWebResearch(prompt);

  return {
    prompt: buildPromptWithWebResearch(prompt, webSearch),
    webSearch,
  };
}
