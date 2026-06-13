const assert = require("node:assert/strict");
const test = require("node:test");

const {
  clampMariaWindowBounds,
  resolveMariaWindowBoundsAfterResize,
} = require("./maria-window-bounds.cjs");

const area = { x: 100, y: 50, width: 800, height: 600 };

test("clampMariaWindowBounds allows limited overflow for icon reachability", () => {
  // Area {100, 50, 800, 600}, margin 4.
  // width 240. minX = 104 - (240-80) = -56. maxX = 900 - 80 - 4 = 816.
  // height 180. minY = 54 - (180-80) = -46. maxY = 650 - 80 - 4 = 566.
  assert.deepEqual(
    clampMariaWindowBounds({ x: 80, y: 40, width: 240, height: 180 }, area),
    { x: 80, y: 40, width: 240, height: 180 }
  );
});

test("clampMariaWindowBounds ensures at least 80px remains on screen", () => {
  assert.deepEqual(
    clampMariaWindowBounds({ x: -1000, y: -1000, width: 240, height: 180 }, area),
    { x: -56, y: -46, width: 240, height: 180 }
  );

  assert.deepEqual(
    clampMariaWindowBounds({ x: 2000, y: 2000, width: 240, height: 180 }, area),
    { x: 816, y: 566, width: 240, height: 180 }
  );
});

test("resolveMariaWindowBoundsAfterResize preserves right and bottom edge anchoring", () => {
  // Area {100, 50, 800, 600}, margin 4. rightEdge = 896, bottomEdge = 646.
  // edgeAnchorPx = 24.
  // currentBounds { x: 650, y: 500, width: 240, height: 140 }
  // right = 650 + 240 = 890. 890 >= 896 - 24 (872) is true.
  // bottom = 500 + 140 = 640. 640 >= 646 - 24 (622) is true.
  // nextWidth = 320, nextHeight = 220.
  // nextX = 650 + 240 - 320 = 570.
  // nextY = 500 + 140 - 220 = 420.
  assert.deepEqual(
    resolveMariaWindowBoundsAfterResize(
      { x: 650, y: 500, width: 240, height: 140 },
      { width: 320, height: 220 },
      area
    ),
    { x: 570, y: 420, width: 320, height: 220 }
  );
});

test("resolveMariaWindowBoundsAfterResize keeps top-left anchored windows stable", () => {
  assert.deepEqual(
    resolveMariaWindowBoundsAfterResize(
      { x: 140, y: 90, width: 240, height: 140 },
      { width: 320, height: 220 },
      area
    ),
    { x: 140, y: 90, width: 320, height: 220 }
  );
});

test("resolveMariaWindowBoundsAfterResize rejects non-finite requested sizes", () => {
  assert.equal(
    resolveMariaWindowBoundsAfterResize(
      { x: 140, y: 90, width: 240, height: 140 },
      { width: Number.NaN, height: 220 },
      area
    ),
    null
  );
});
