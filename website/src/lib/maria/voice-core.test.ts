import assert from "node:assert/strict";
import test from "node:test";
import {
  getDictionaryKeyterms,
  processVoiceTranscript,
  type MariaVoiceDictionaryEntry,
  type MariaVoiceSnippet,
} from "./voice-core";

function dictionaryEntry(partial: Partial<MariaVoiceDictionaryEntry>): MariaVoiceDictionaryEntry {
  return {
    id: partial.id || "dict",
    userId: "user",
    teamId: partial.teamId ?? null,
    scope: partial.scope || "personal",
    spoken: partial.spoken || "",
    replacement: partial.replacement || "",
    keyterms: partial.keyterms || [],
    priority: partial.priority || 0,
    enabled: partial.enabled !== false,
  };
}

function snippet(partial: Partial<MariaVoiceSnippet>): MariaVoiceSnippet {
  return {
    id: partial.id || "snippet",
    userId: "user",
    teamId: partial.teamId ?? null,
    scope: partial.scope || "personal",
    trigger: partial.trigger || "",
    expansion: partial.expansion || "",
    priority: partial.priority || 0,
    enabled: partial.enabled !== false,
  };
}

test("cleans fillers, punctuation, casing, and backtracking", () => {
  const result = processVoiceTranscript({
    transcript: "um lets meet at 2 actually 3 comma thanks",
  });

  assert.equal(result.text, "Lets meet at 3, thanks.");
});

test("formats numbered lists from spoken item numbers", () => {
  const result = processVoiceTranscript({
    transcript: "1 apples 2 bananas 3 oranges",
  });

  assert.equal(result.text, "1. Apples\n2. Bananas\n3. Oranges");
});

test("applies dictionary with personal priority over team entries", () => {
  const result = processVoiceTranscript({
    transcript: "ship rearvy today",
    dictionary: [
      dictionaryEntry({
        id: "team",
        scope: "team",
        spoken: "rearvy",
        replacement: "Rearview",
        priority: 10,
      }),
      dictionaryEntry({
        id: "personal",
        scope: "personal",
        spoken: "rearvy",
        replacement: "Rearvy",
        priority: 1,
      }),
    ],
  });

  assert.equal(result.text, "Ship Rearvy today.");
  assert.deepEqual(result.appliedDictionaryIds, ["personal"]);
});

test("expands the longest matching snippet first", () => {
  const result = processVoiceTranscript({
    transcript: "use my support intro",
    snippets: [
      snippet({ id: "short", trigger: "support", expansion: "help desk" }),
      snippet({ id: "long", trigger: "my support intro", expansion: "Hi, thanks for reaching out." }),
    ],
  });

  assert.equal(result.text, "Use Hi, thanks for reaching out.");
  assert.deepEqual(result.appliedSnippetIds, ["long"]);
});

test("strips trailing press enter and marks the paste action", () => {
  const result = processVoiceTranscript({
    transcript: "send hello world press enter",
  });

  assert.equal(result.text, "Send hello world.");
  assert.equal(result.pressEnter, true);
});

test("converts developer file tags and syntax in code context", () => {
  const result = processVoiceTranscript({
    transcript: "tag main dot tsx set camel case user id equals request id",
    activeContext: {
      appName: "Cursor",
      title: "rearvy2.0",
      workspaceFiles: ["main.tsx", "voice-core.ts"],
    },
  });

  assert.equal(result.text, "@main.tsx set userId = request id");
  assert.deepEqual(result.appliedFileTags, ["main.tsx"]);
});

test("formats terminal commands without sentence punctuation", () => {
  const result = processVoiceTranscript({
    transcript: "npm install dash dash save dash dev lucide react",
    activeContext: {
      appName: "Windows Terminal",
      title: "PowerShell",
    },
  });

  assert.equal(result.text, "npm install --save-dev lucide react");
});

test("command mode replaces selection with deterministic edit fallback", () => {
  const result = processVoiceTranscript({
    mode: "command",
    transcript: "make this more concise",
    selectedText: "Due to the fact that we are late, we should respond at this point in time.",
  });

  assert.equal(result.replaceSelection, true);
  assert.equal(result.text, "Because we are late, we should respond now.");
});

test("dictionary keyterms are clamped for AssemblyAI prompts", () => {
  const terms = getDictionaryKeyterms([
    dictionaryEntry({ replacement: "Rearvy", keyterms: ["Maria", "too many words in this phrase should be ignored now"] }),
  ]);

  assert.deepEqual(terms, ["Rearvy", "Maria"]);
});
