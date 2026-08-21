import assert from "node:assert/strict";
import test from "node:test";
import { classifyFileMemory } from "./filesystem-memory";

test("routes contacts and credentials to safe categories", () => {
    assert.equal(classifyFileMemory("John's phone number is +91 9876543210"), "People");
    assert.equal(classifyFileMemory("Instagram password changed"), "Credentials");
  });

test("routes project, calendar, and research notes", () => {
    assert.equal(classifyFileMemory("Rearvy launch project milestone"), "Projects");
    assert.equal(classifyFileMemory("Meeting scheduled for Friday"), "Calendar");
    assert.equal(classifyFileMemory("Competitor research findings"), "Research");
  });
