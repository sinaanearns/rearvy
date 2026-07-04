/**
 * Detects whether a user message intends to trigger a multi-step orchestration
 * rather than a single simple conversation turn.
 *
 * Runs quickly using regex and keyword checks (avoiding costly LLM calls).
 */
export function detectOrchestrationIntent(text: string | null | undefined): boolean {
  if (!text) {
    return false;
  }

  const query = text.toLowerCase().trim();

  // Explicit keywords requesting planning/orchestration
  const explicitKeywords = [
    /\b(orchestrate|orchestration|plan steps|multi-step plan|execution plan)\b/,
    /\b(create|generate|write) (a )?(full |detailed )?(plan|workflow|blueprint)\b/,
    /\brun (a )?(complex )?workflow\b/,
  ];

  for (const regex of explicitKeywords) {
    if (regex.test(query)) {
      return true;
    }
  }

  // Compound objectives (e.g. "do X then Y", "do X and then Y")
  const compoundPattern = /\b(then|after that|subsequently|first.*then|and then)\b/;
  const actionVerbs = [
    "research", "search", "find", "scrape", "draft", "write", "send",
    "email", "gmail", "create", "generate", "analyze", "run", "execute", "save"
  ];

  // If there's a sequencing connector AND at least 2 different action verbs, trigger orchestrator
  if (compoundPattern.test(query)) {
    let verbCount = 0;
    for (const verb of actionVerbs) {
      if (query.includes(verb)) {
        verbCount++;
      }
    }
    if (verbCount >= 2) {
      return true;
    }
  }

  return false;
}
