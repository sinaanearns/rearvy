import {
  planWebResearch,
  type PlanWebResearchInput,
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
You are using the configured default chat model only. Do not call tools in this response.
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

  // Keep the free tier responsive: skip synchronous web prefetching here and
  // let the normal web tools answer only when the model decides it needs them.
  return null;
}
