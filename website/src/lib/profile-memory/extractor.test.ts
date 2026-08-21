import test from "node:test";
import assert from "node:assert/strict";

import { extractProfileMemoryEntries, mergeProfileMemoryEntries } from "./extractor";

test("extracts known tools from a free-form description", () => {
  const entries = extractProfileMemoryEntries(
    "DaVinci Resolve is my video editor. VS Code is my code editor and Codex is my AI coding assistant."
  );
  const slots = Object.fromEntries(entries.map((entry) => [entry.slot, entry.value]));

  assert.equal(slots.video_editor, "DaVinci Resolve");
  assert.equal(slots.code_editor, "VS Code");
  assert.equal(slots.ai_coding_assistant, "Codex");
});

test("captures the count of code editors the user mentioned", () => {
  const entries = extractProfileMemoryEntries(
    "I use VS Code, WebStorm, and PyCharm for my coding work."
  );
  const codeEditors = entries.filter((entry) => entry.slot === "code_editor");
  assert.ok(codeEditors.length >= 2, "expected at least two code editors");
  const labels = codeEditors.map((entry) => entry.value).sort();
  assert.deepEqual(labels, ["PyCharm", "VS Code", "WebStorm"]);
});

test("uses user-stated importance for known tools when confirmed", () => {
  const entries = extractProfileMemoryEntries("My code editor is VS Code.");
  const codex = entries.find((entry) => entry.slot === "code_editor");
  assert.ok(codex, "expected a code editor entry");
  assert.equal(codex?.value, "VS Code");
  assert.ok((codex?.tags || []).includes("user-confirmed"));
});

test("mergeProfileMemoryEntries adds new facts and upgrades existing ones", () => {
  const initial = [
    {
      slot: "code_editor" as const,
      label: "Code editor",
      value: "VS Code",
      importance: 7,
      tags: ["known-software"],
    },
  ];
  const incoming = extractProfileMemoryEntries("I use Cursor as my AI coding assistant.");
  const { snapshot, added, upgraded } = mergeProfileMemoryEntries(initial, incoming);

  assert.equal(snapshot.length, 2);
  assert.equal(added.length, 1, "expected Cursor to be added");
  assert.equal(added[0]?.slot, "ai_coding_assistant");
  assert.equal(upgraded.length, 0, "no upgrade expected on first merge");
});
