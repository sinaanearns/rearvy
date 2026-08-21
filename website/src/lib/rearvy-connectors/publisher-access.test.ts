import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isBusinessPublisherProfile,
  isEligibleBusinessRegistration,
  normalizePublisherEmail,
} from "./publisher-access";

describe("connector publisher access", () => {
  it("recognizes dedicated business account profiles", () => {
    assert.equal(isBusinessPublisherProfile({ account_kind: "business" }), true);
    assert.equal(isBusinessPublisherProfile({ account_kind: "user" }), false);
    assert.equal(isBusinessPublisherProfile(null), false);
  });

  it("accepts active registration lifecycle states", () => {
    for (const status of ["new", "reviewed", "contacted", "approved"]) {
      assert.equal(isEligibleBusinessRegistration({ status }), true);
    }
  });

  it("rejects revoked, rejected, and malformed registrations", () => {
    for (const status of ["rejected", "revoked", "suspended", ""]) {
      assert.equal(isEligibleBusinessRegistration({ status }), false);
    }
    assert.equal(isEligibleBusinessRegistration(null), false);
  });

  it("normalizes authenticated email addresses for registration lookup", () => {
    assert.equal(normalizePublisherEmail("  Owner@Example.COM "), "owner@example.com");
    assert.equal(normalizePublisherEmail("not-an-email"), null);
    assert.equal(normalizePublisherEmail(null), null);
  });
});
