import assert from "node:assert/strict";
import test from "node:test";

import { APP_NAME } from "@/lib/utils/constants";
import { buildSystemPrompt, type LoadedSystemPromptContext } from "./system-prompt";

function makeContext(
  overrides: Partial<LoadedSystemPromptContext> = {}
): LoadedSystemPromptContext {
  return {
    integrations: [],
    websites: [],
    memories: [],
    profileMemory: { entries: [], updated_at: null, source: null },
    project: null,
    projectTemplateAddon: null,
    ...overrides,
  };
}

test("buildSystemPrompt normalizes stale business display names", () => {
  const prompt = buildSystemPrompt({
    context: makeContext({
      profile: {
        business_name: "  RARVILLE  ",
        business_type: "agency",
      },
    }),
  });

  assert.match(prompt, new RegExp(`AI business advisor for ${APP_NAME}\\.`));
  assert.doesNotMatch(prompt, /RARVILLE/);
});
