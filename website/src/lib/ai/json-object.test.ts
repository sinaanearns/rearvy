import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractFirstJsonArray,
  extractFirstJsonObject,
  parseJsonArray,
  parseJsonArrayFromText,
  parseJsonRecord,
  parseJsonRecordFromText,
  parseJsonValue,
  stripJsonFence,
} from "./json-object";

describe("json-object helpers", () => {
  it("strips optional JSON fences", () => {
    assert.equal(stripJsonFence('```json\n{"ok":true}\n```'), '{"ok":true}');
    assert.equal(stripJsonFence('```\n{"ok":true}\n```'), '{"ok":true}');
  });

  it("extracts a balanced JSON object while respecting strings", () => {
    assert.equal(
      extractFirstJsonObject('prefix {"text":"Use { and } safely"} suffix'),
      '{"text":"Use { and } safely"}'
    );
  });

  it("extracts a balanced JSON array while respecting strings and nested values", () => {
    assert.equal(
      extractFirstJsonArray('prefix [{"text":"Use [ and ] safely","nested":{"ok":true}}] suffix'),
      '[{"text":"Use [ and ] safely","nested":{"ok":true}}]'
    );
  });

  it("returns records only for object JSON", () => {
    assert.deepEqual(parseJsonRecord('{"ok":true}'), { ok: true });
    assert.equal(parseJsonRecord("[]"), null);
    assert.equal(parseJsonRecord("broken"), null);
  });

  it("parses any valid JSON value", () => {
    assert.deepEqual(parseJsonValue('{"ok":true}'), { ok: true });
    assert.deepEqual(parseJsonValue("[1,2]"), [1, 2]);
    assert.equal(parseJsonValue('"hello"'), "hello");
    assert.equal(parseJsonValue("broken"), null);
  });

  it("returns arrays only for array JSON", () => {
    assert.deepEqual(parseJsonArray('[{"ok":true}]'), [{ ok: true }]);
    assert.equal(parseJsonArray('{"ok":true}'), null);
    assert.equal(parseJsonArray("broken"), null);
  });

  it("parses fenced or embedded records from text", () => {
    assert.deepEqual(parseJsonRecordFromText('```json\n{"text":"Hello"}\n```'), {
      text: "Hello",
    });
    assert.deepEqual(parseJsonRecordFromText('Here: {"text":"Hello"}'), {
      text: "Hello",
    });
  });

  it("parses fenced or embedded arrays from text", () => {
    assert.deepEqual(parseJsonArrayFromText('```json\n[{"text":"Hello"}]\n```'), [
      { text: "Hello" },
    ]);
    assert.deepEqual(parseJsonArrayFromText('Here: [{"text":"Hello"}] trailing [bad]'), [
      { text: "Hello" },
    ]);
  });
});
