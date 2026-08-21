import assert from "node:assert/strict";
import test from "node:test";

import { metadata as forbiddenMetadata } from "./403/layout";
import { metadata as authMetadata } from "./(auth)/layout";
import { metadata as desktopAuthMetadata } from "./desktop-auth/layout";
import { metadata as dashboardMetadata } from "./(dashboard)/layout";
import { metadata as mariaListenerMetadata } from "./maria-listener/layout";
import { metadata as mariaOverlayMetadata } from "./maria-overlay/layout";

type RobotsObject = {
  index?: boolean;
  follow?: boolean;
};

const operationalMetadata = [
  ["access denied", forbiddenMetadata],
  ["auth account", authMetadata],
  ["dashboard workspace", dashboardMetadata],

  ["desktop auth", desktopAuthMetadata],
  ["maria listener", mariaListenerMetadata],
  ["maria overlay", mariaOverlayMetadata],
] as const;

function getRobotsObject(metadata: (typeof operationalMetadata)[number][1]) {
  const robots = metadata.robots;

  if (typeof robots !== "object" || robots === null) {
    throw new Error("Expected robots metadata to be an object.");
  }

  return robots as RobotsObject;
}

test("operational client routes are noindexed", () => {
  for (const [label, metadata] of operationalMetadata) {
    const robots = getRobotsObject(metadata);

    assert.equal(robots.index, false, label);
    assert.equal(robots.follow, false, label);
  }
});

test("operational client routes have explicit metadata titles", () => {
  for (const [label, metadata] of operationalMetadata) {
    assert.equal(typeof metadata.title, "string", label);
    assert.match(String(metadata.title), /Rearvy/, label);
    assert.equal(typeof metadata.description, "string", label);
  }
});
