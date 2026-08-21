import assert from "node:assert/strict";
import test from "node:test";

import { detectDocumentGenerationIntent } from "./document-intent.ts";

test("detects direct PDF document requests", () => {
  const intent = detectDocumentGenerationIntent(
    "make a pdf proposal for a Shopify retention campaign"
  );

  assert.equal(intent?.documentType, "proposal");
  assert.deepEqual(intent?.formats, ["pdf"]);
  assert.equal(intent?.brief, "proposal for a Shopify retention campaign");
});

test("detects Word and all-format requests", () => {
  const intent = detectDocumentGenerationIntent(
    "create a Microsoft Word doc and all formats about Q2 agency performance"
  );

  assert.equal(intent?.documentType, "document");
  assert.deepEqual(intent?.formats, ["pdf", "docx", "markdown", "txt", "html"]);
  assert.equal(intent?.brief, "Q2 agency performance");
});

test("detects slash document commands", () => {
  const intent = detectDocumentGenerationIntent("/pdf launch plan for Rearvy");

  assert.ok(intent);
  assert.equal(intent.formats?.[0], "pdf");
  assert.equal(intent.brief, "launch plan for Rearvy");
});

test("detects presentation and slide deck requests", () => {
  const intent = detectDocumentGenerationIntent(
    "create a slide deck about Q2 agency performance"
  );

  assert.equal(intent?.documentType, "presentation");
  assert.deepEqual(intent?.formats, ["pdf", "docx"]);
  assert.equal(intent?.brief, "Q2 agency performance");
});

test("detects slash slide commands", () => {
  const intent = detectDocumentGenerationIntent("/slides Rearvy investor update");

  assert.equal(intent?.documentType, "presentation");
  assert.equal(intent?.brief, "Rearvy investor update");
});

test("does not hijack engineering requests about document generation bugs", () => {
  assert.equal(
    detectDocumentGenerationIntent("fix the pdf generation bug in the route"),
    null
  );
});
