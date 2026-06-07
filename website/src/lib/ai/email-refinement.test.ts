import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseRefinedEmailDraft } from "./email-refinement";

describe("parseRefinedEmailDraft", () => {
  it("parses a plain JSON email draft", () => {
    assert.deepEqual(
      parseRefinedEmailDraft('{"subject":" Hello ","body":" Updated body " }'),
      {
        subject: "Hello",
        body: "Updated body",
      }
    );
  });

  it("parses a fenced JSON email draft", () => {
    assert.deepEqual(
      parseRefinedEmailDraft(
        '```json\n{"subject":"Follow up","body":"Thanks for your time."}\n```'
      ),
      {
        subject: "Follow up",
        body: "Thanks for your time.",
      }
    );
  });

  it("extracts the first complete JSON object without swallowing trailing prose", () => {
    assert.deepEqual(
      parseRefinedEmailDraft(
        'Here is the draft: {"subject":"A {nested} note","body":"Use } safely."} Extra text.'
      ),
      {
        subject: "A {nested} note",
        body: "Use } safely.",
      }
    );
  });

  it("rejects non-object or bodyless responses", () => {
    assert.equal(parseRefinedEmailDraft("[]"), null);
    assert.equal(parseRefinedEmailDraft('{"subject":"Only subject"}'), null);
    assert.equal(parseRefinedEmailDraft("not json"), null);
  });
});
