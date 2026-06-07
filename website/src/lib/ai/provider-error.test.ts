import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseProviderErrorResponse,
  parseProviderErrorText,
} from "./provider-error";

describe("provider error parsing", () => {
  it("reads common provider error shapes", () => {
    assert.equal(
      parseProviderErrorText('{"error":"quota exceeded"}', "fallback"),
      "quota exceeded"
    );
    assert.equal(
      parseProviderErrorText('{"error":{"message":"bad model"}}', "fallback"),
      "bad model"
    );
    assert.equal(
      parseProviderErrorText('{"message":"service unavailable"}', "fallback"),
      "service unavailable"
    );
  });

  it("extracts wrapped JSON without swallowing trailing braces", () => {
    assert.equal(
      parseProviderErrorText(
        'Error: {"error":{"message":"Use {valid} model"}} trailing {not json}',
        "fallback"
      ),
      "Use {valid} model"
    );
  });

  it("falls back to raw text or the supplied fallback", () => {
    assert.equal(parseProviderErrorText(" plain failure ", "fallback"), "plain failure");
    assert.equal(parseProviderErrorText(" ", "fallback"), "fallback");
  });

  it("builds a provider/status fallback from a response", async () => {
    const message = await parseProviderErrorResponse(
      new Response("", { status: 503 }),
      "Test Provider"
    );

    assert.equal(message, "Test Provider request failed with 503");
  });
});
