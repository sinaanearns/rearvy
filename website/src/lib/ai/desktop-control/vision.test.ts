import assert from "node:assert/strict";
import test from "node:test";

import {
  findElementByText,
  findNearestClickable,
  parseDetectedUiElements,
} from "./vision.ts";
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

test("parseDetectedUiElements handles fenced UI element JSON", () => {
  assert.deepEqual(
    parseDetectedUiElements(
      '```json\n[{"id":"save","type":"button","text":"Save","x":"10","y":20,"width":80,"height":30,"clickable":"true","confidence":1.5}]\n```'
    ),
    [
      {
        id: "save",
        type: "button",
        text: "Save",
        position: { x: 10, y: 20, width: 80, height: 30 },
        clickable: true,
        visible: true,
        confidence: 1,
      },
    ]
  );
});

test("parseDetectedUiElements extracts the first balanced array without swallowing trailing text", () => {
  assert.deepEqual(
    parseDetectedUiElements(
      'Elements: [{"id":"search","type":"input","text":"Search [box]","x":5,"y":6,"width":100,"height":20,"clickable":false}] trailing [not json]'
    ),
    [
      {
        id: "search",
        type: "input",
        text: "Search [box]",
        position: { x: 5, y: 6, width: 100, height: 20 },
        clickable: false,
        visible: true,
        confidence: undefined,
      },
    ]
  );
});

test("parseDetectedUiElements ignores invalid array entries and malformed JSON", () => {
  assert.deepEqual(
    parseDetectedUiElements('[null,{"id":"ok","type":"unknown","text":"","x":0,"y":0,"width":0,"height":0}]'),
    [
      {
        id: "ok",
        type: "other",
        text: "",
        position: { x: 0, y: 0, width: 0, height: 0 },
        clickable: false,
        visible: true,
        confidence: undefined,
      },
    ]
  );
  assert.deepEqual(parseDetectedUiElements("not json"), []);
});
