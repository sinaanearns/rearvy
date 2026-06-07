import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeGeneratedDocumentIntegrity,
  createGeneratedDocumentFiles,
  normalizeGeneratedDocumentMarkdown,
} from "./document-generation.ts";

test("creates downloadable PDF, DOCX, markdown, text, and HTML files", async () => {
  const markdown = normalizeGeneratedDocumentMarkdown(
    [
      "# Launch Plan",
      "",
      "This plan outlines the first week of launch activity.",
      "",
      "## Priorities",
      "",
      "- Announce the release",
      "- Review customer feedback",
      "",
      "## Next Steps",
      "",
      "1. Publish the landing page",
      "2. Send the partner update",
    ].join("\n"),
    "Launch Plan"
  );

  const files = await createGeneratedDocumentFiles({
    title: "Launch Plan",
    markdown,
    formats: ["pdf", "docx", "markdown", "txt", "html"],
  });

  assert.equal(files.length, 5);

  const pdf = files.find((file) => file.format === "pdf");
  assert.ok(pdf);
  assert.equal(Buffer.from(pdf.base64, "base64").subarray(0, 4).toString(), "%PDF");

  const docx = files.find((file) => file.format === "docx");
  assert.ok(docx);
  assert.equal(Buffer.from(docx.base64, "base64").subarray(0, 2).toString(), "PK");

  const markdownFile = files.find((file) => file.format === "markdown");
  assert.ok(markdownFile);
  assert.match(Buffer.from(markdownFile.base64, "base64").toString("utf8"), /# Launch Plan/);

  const html = files.find((file) => file.format === "html");
  assert.ok(html);
  assert.match(Buffer.from(html.base64, "base64").toString("utf8"), /<!doctype html>/i);
});

test("preserves numbered list values in text and HTML exports", async () => {
  const markdown = normalizeGeneratedDocumentMarkdown(
    [
      "# Launch Plan",
      "",
      "## Next Steps",
      "",
      "1. Publish the landing page",
      "2. Send the partner update",
    ].join("\n"),
    "Launch Plan"
  );

  const files = await createGeneratedDocumentFiles({
    title: "Launch Plan",
    markdown,
    formats: ["txt", "html"],
  });

  const text = files.find((file) => file.format === "txt");
  assert.ok(text);
  assert.match(
    Buffer.from(text.base64, "base64").toString("utf8"),
    /1\. Publish the landing page\n2\. Send the partner update/
  );

  const html = files.find((file) => file.format === "html");
  assert.ok(html);
  const htmlText = Buffer.from(html.base64, "base64").toString("utf8");
  assert.match(htmlText, /<ol start="1">/);
  assert.match(htmlText, /<li value="2">Send the partner update<\/li>/);
  assert.equal((htmlText.match(/<ol/g) || []).length, 1);
});

test("sanitizes generated file names after truncation", async () => {
  const markdown = normalizeGeneratedDocumentMarkdown(
    [
      "# Very Long Launch Strategy For Enterprise Partners With Regional Playbooks And 2026 Rollout",
      "",
      "This document keeps the filename stable.",
    ].join("\n"),
    "Launch Strategy"
  );

  const [file] = await createGeneratedDocumentFiles({
    title: "Launch Strategy",
    markdown,
    formats: ["markdown"],
  });

  assert.ok(file);
  assert.equal(
    file.fileName,
    "very-long-launch-strategy-for-enterprise-partners-with-regional.md"
  );
});

test("marks generated documents with placeholders as review-required", () => {
  const integrity = analyzeGeneratedDocumentIntegrity(
    [
      "# Campaign Draft",
      "",
      "Launch copy for [NEEDS: offer].",
      "",
      "## Assumptions to review",
      "",
      "- Audience is existing customers.",
    ].join("\n")
  );

  assert.equal(integrity.reviewRequired, true);
  assert.equal(integrity.placeholderCount, 1);
  assert.equal(integrity.assumptionsDetected, true);
});
