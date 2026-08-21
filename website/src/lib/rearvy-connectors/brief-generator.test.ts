import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { cleanCapabilityItems, generateStructuredConnectorBrief } from "./brief-generator";

describe("brief-generator", () => {
  test("cleans multiline capability items", () => {
    const raw = "- search video database\n* export clip\n• schedule upload";
    const items = cleanCapabilityItems(raw);
    assert.equal(items.length, 3);
    assert.equal(items[0], "search video database");
    assert.equal(items[1], "export clip");
    assert.equal(items[2], "schedule upload");
  });

  test("segments run-on natural language prompt into discrete items", () => {
    const raw =
      "cliping.com is a free cliping website. you either share youtube link or video then it anylis the video and shares clipped videos on library, then proceeded on video editing for the user to manually edit";
    const items = cleanCapabilityItems(raw);
    assert.ok(items.length > 1);
  });

  test("generates structured connector brief with platform name and security blueprint", () => {
    const brief = generateStructuredConnectorBrief(
      "Website",
      "cliping.com lets users upload youtube link, auto-clip video, and schedule upload to multiple channels"
    );
    assert.ok(brief.includes("# Rearvy Connector Brief & AI Specification"));
    assert.ok(brief.includes("cliping.com"));
    assert.ok(brief.includes("rearvy.capabilities.md"));
    assert.ok(brief.includes("Private Adapter Implementation"));
    assert.ok(brief.includes("Instructions for AI Coding Agents"));
  });
});
