import {
  performWebPageFetch,
  performWebSearch,
  type PublicWebSearchResult,
} from "./tools/web";
import {
  planWebResearch,
  type PlanWebResearchInput,
  type WebResearchPlan,
} from "./web-research-intent";

export type FreeTierWebResearchMetadata = {
  webIntentMatched: boolean;
  candidateQueries: string[];
  winningQuery: string | null;
  resultsCount: number;
  usedFreeTierWebResearchMode: boolean;
};

export type FreeTierWebResearchResult = {
  systemAddition: string;
  metadata: FreeTierWebResearchMetadata;
};

type SearchAttempt = {
  query: string;
  message: string;
  results: PublicWebSearchResult[];
};

async function searchCandidateQueries(
  plan: WebResearchPlan
): Promise<SearchAttempt> {
  let lastAttempt: SearchAttempt = {
    query: plan.candidateQueries[0] ?? "",
    message: "No search queries were available.",
    results: [],
  };

  for (const query of plan.candidateQueries) {
    const search = await performWebSearch(query, 6);
    lastAttempt = {
      query,
      message: search.message,
      results: search.results,
    };

    if (search.results.length > 0) {
      return lastAttempt;
    }
  }

  return lastAttempt;
}

export async function buildFreeTierWebResearchContext(
  input: PlanWebResearchInput
): Promise<FreeTierWebResearchResult | null> {
  const plan = planWebResearch(input);

  if (!plan.intentMatched) {
    return null;
  }

  if (plan.mode === "clarify") {
    return {
      systemAddition: `FREE-TIER WEB RESEARCH MODE:
You are using Kimi only. Do not call tools in this response.
The user requested external web research, but the topic is still too vague.
Ask exactly one short follow-up question and wait for the user's answer.

Follow-up question: ${plan.clarificationQuestion ?? "What specific topic should I search for on the web?"}`,
      metadata: {
        webIntentMatched: true,
        candidateQueries: [],
        winningQuery: null,
        resultsCount: 0,
        usedFreeTierWebResearchMode: true,
      },
    };
  }

  const searchAttempt = await searchCandidateQueries(plan);
  const topResults = searchAttempt.results.slice(0, 3);
  const fetchedPages = await Promise.all(
    topResults.map((result) => performWebPageFetch(result.url, 2200))
  );

  const resultsSection =
    topResults.length > 0
      ? topResults
          .map(
            (result) =>
              `- ${result.title} | ${result.source} | ${result.url}\n  Snippet: ${result.snippet || "No snippet provided."}`
          )
          .join("\n")
      : "- No public web results were found for the attempted queries.";

  const pagesSection =
    fetchedPages.length > 0
      ? fetchedPages
          .map((page, index) => {
            const sourceLine = topResults[index]
              ? `${topResults[index].title} | ${topResults[index].source}`
              : page.url;
            return `Source ${index + 1}: ${sourceLine}\n${page.content || page.message}`;
          })
          .join("\n\n")
      : "No page excerpts available.";

  return {
    systemAddition: `FREE-TIER WEB RESEARCH MODE:
You are using Kimi only. Do not call tools in this response.
The server already collected public web research for the user.
Answer using the research below, be concise, and cite source domains inline.
If the research is weak, say that clearly and give the best next step.

Research strategy: ${plan.strategy}
Topic summary: ${plan.topicSummary ?? "general external research"}
Candidate queries: ${plan.candidateQueries.join(" | ")}
Winning query: ${searchAttempt.query || "none"}
Search status: ${searchAttempt.message}

Search results:
${resultsSection}

Readable source excerpts:
${pagesSection}`,
    metadata: {
      webIntentMatched: true,
      candidateQueries: plan.candidateQueries,
      winningQuery: searchAttempt.query || null,
      resultsCount: topResults.length,
      usedFreeTierWebResearchMode: true,
    },
  };
}
