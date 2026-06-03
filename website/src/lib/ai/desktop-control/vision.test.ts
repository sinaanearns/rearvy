import assert from "node:assert/strict";
import test from "node:test";

import { findElementByText, findNearestClickable } from "./vision.ts";
import type { UIElement } from "./types";

const elements: UIElement[] = [
  {
    id: "label",
    type: "text",
    text: "Email address",
    position: { x: 10, y: 10, width: 140, height: 20 },
    clickable: false,
    visible: true,
  },
  {
    id: "submit",
    type: "button",
    text: "Submit form",
    position: { x: 100, y: 100, width: 80, height: 40 },
    clickable: true,
    visible: true,
  },
  {
    id: "cancel",
    type: "button",
    text: "Cancel",
    position: { x: 240, y: 110, width: 80, height: 40 },
    clickable: true,
    visible: true,
  },
];

test("findElementByText only returns clickable matching elements", () => {
  assert.equal(findElementByText(elements, "email"), undefined);
  assert.equal(findElementByText(elements, "submit"), elements[1]);
});

test("findNearestClickable returns the closest clickable element within range", () => {
  assert.equal(findNearestClickable(elements, 142, 122), elements[1]);
  assert.equal(findNearestClickable(elements, 10, 10, 10), undefined);
});
