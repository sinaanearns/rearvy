import assert from "node:assert/strict";
import test from "node:test";

import { enrichImagePromptWithWebResearch } from "./image-generation-research.ts";

test("adds web search notes before image generation", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalSearch = process.env.IMAGE_GENERATION_WEB_SEARCH;
  const originalLimit = process.env.IMAGE_GENERATION_WEB_SEARCH_LIMIT;
  const originalGoogleKey = process.env.GOOGLE_SEARCH_API_KEY;
  const originalGoogleCx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalSearch === undefined) delete process.env.IMAGE_GENERATION_WEB_SEARCH;
    else process.env.IMAGE_GENERATION_WEB_SEARCH = originalSearch;
    if (originalLimit === undefined) delete process.env.IMAGE_GENERATION_WEB_SEARCH_LIMIT;
    else process.env.IMAGE_GENERATION_WEB_SEARCH_LIMIT = originalLimit;
    if (originalGoogleKey === undefined) delete process.env.GOOGLE_SEARCH_API_KEY;
    else process.env.GOOGLE_SEARCH_API_KEY = originalGoogleKey;
    if (originalGoogleCx === undefined) delete process.env.GOOGLE_SEARCH_ENGINE_ID;
    else process.env.GOOGLE_SEARCH_ENGINE_ID = originalGoogleCx;
  });

  process.env.IMAGE_GENERATION_WEB_SEARCH = "true";
  process.env.IMAGE_GENERATION_WEB_SEARCH_LIMIT = "1";
  delete process.env.GOOGLE_SEARCH_API_KEY;
  delete process.env.GOOGLE_SEARCH_ENGINE_ID;

  globalThis.fetch = (async (url) => {
    const requestedUrl = String(url);
    assert.match(requestedUrl, /duckduckgo\.com\/html/);

    return new Response(
      `
      <a class="result__a" href="https://example.com/chicken">Chicken visual guide</a>
      <a class="result__snippet">Chickens have red combs, wattles, beaks, and layered feathers.</a>
      `,
      {
        status: 200,
        headers: { "content-type": "text/html" },
      }
    );
  }) as typeof fetch;

  const result = await enrichImagePromptWithWebResearch(
    "A clear image of a chicken"
  );

  assert.equal(result.webSearch?.results.length, 1);
  assert.match(result.prompt, /Chicken visual guide/);
  assert.match(result.prompt, /red combs/);
});

test("returns the original prompt when image web search is disabled", async (t) => {
  const originalSearch = process.env.IMAGE_GENERATION_WEB_SEARCH;

  t.after(() => {
    if (originalSearch === undefined) delete process.env.IMAGE_GENERATION_WEB_SEARCH;
    else process.env.IMAGE_GENERATION_WEB_SEARCH = originalSearch;
  });

  process.env.IMAGE_GENERATION_WEB_SEARCH = "false";

  const result = await enrichImagePromptWithWebResearch(
    "A clear image of a chicken"
  );

  assert.equal(result.prompt, "A clear image of a chicken");
  assert.equal(result.webSearch, null);
});
