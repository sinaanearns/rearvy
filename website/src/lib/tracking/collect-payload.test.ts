import assert from "node:assert/strict";
import test from "node:test";
import {
  isTrackingEvent,
  parseTrackingPath,
  parseTrackingPayload,
} from "./collect-payload";

const baseEvent = {
  type: "pageview",
  visitor_id: "visitor-1",
  session_id: "session-1",
  timestamp: "2026-06-05T00:00:00.000Z",
  url: "https://example.com/products",
};

test("parseTrackingPayload accepts JSON objects only", () => {
  assert.deepEqual(parseTrackingPayload('{"site_id":"site-1","events":[]}'), {
    site_id: "site-1",
    events: [],
  });
  assert.equal(parseTrackingPayload("not-json"), null);
  assert.equal(parseTrackingPayload("[]"), null);
  assert.equal(parseTrackingPayload('"text"'), null);
});

test("isTrackingEvent accepts valid tracking events", () => {
  assert.equal(
    isTrackingEvent({
      ...baseEvent,
      properties: { button: "buy" },
      screen_width: 1440,
      screen_height: 900,
    }),
    true
  );
  assert.equal(isTrackingEvent({ ...baseEvent, type: "custom" }), true);
  assert.equal(isTrackingEvent({ ...baseEvent, type: "scroll" }), true);
  assert.equal(isTrackingEvent({ ...baseEvent, type: "click" }), true);
});

test("isTrackingEvent rejects malformed tracking events", () => {
  assert.equal(isTrackingEvent({ ...baseEvent, type: "identify" }), false);
  assert.equal(isTrackingEvent({ ...baseEvent, visitor_id: 123 }), false);
  assert.equal(isTrackingEvent({ ...baseEvent, properties: [] }), false);
  assert.equal(isTrackingEvent({ ...baseEvent, screen_width: Number.NaN }), false);
});

test("parseTrackingPath falls back for invalid URLs", () => {
  assert.equal(parseTrackingPath("https://example.com/products?id=1"), "/products");
  assert.equal(parseTrackingPath("not a url"), "/");
});
