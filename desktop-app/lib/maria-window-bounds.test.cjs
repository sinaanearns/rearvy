const assert = require("node:assert/strict");
const test = require("node:test");

const {
  clampMariaWindowBounds,
  resolveMariaWindowBoundsAfterResize,
} = require("./maria-window-bounds.cjs");

const area = { x: 100, y: 50, width: 800, height: 600 };

test("clampMariaWindowBounds keeps normal bounds inside the work area margin", () => {
  assert.deepEqual(
    clampMariaWindowBounds({ x: 80, y: 40, width: 240, height: 180 }, area),
    { x: 108, y: 58, width: 240, height: 180 }
  );
});

test("clampMariaWindowBounds caps oversized bounds to the available work area", () => {
  assert.deepEqual(
    clampMariaWindowBounds({ x: 0, y: 0, width: 2000, height: 2000 }, area),
    { x: 108, y: 58, width: 784, height: 584 }
  );
});

test("resolveMariaWindowBoundsAfterResize preserves right and bottom edge anchoring", () => {
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
