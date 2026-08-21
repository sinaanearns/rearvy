const DEFAULT_SCREEN_MARGIN_PX = 8;
const DEFAULT_EDGE_ANCHOR_PX = 24;

function clampToRange(value, min, max) {
  if (max < min) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function normalizePositivePixelSize(value) {
  const rounded = Math.round(Number(value));
  if (!Number.isFinite(rounded)) {
    return null;
  }

  return Math.max(1, rounded);
}

function clampMariaWindowBounds(bounds, area, options = {}) {
  const margin = normalizePositivePixelSize(options.marginPx) ?? DEFAULT_SCREEN_MARGIN_PX;
  const maxWidth = Math.max(1, Math.round(area.width) - margin * 2);
  const maxHeight = Math.max(1, Math.round(area.height) - margin * 2);
  const width = Math.min(normalizePositivePixelSize(bounds.width) ?? 1, maxWidth);
  const height = Math.min(normalizePositivePixelSize(bounds.height) ?? 1, maxHeight);
  const minX = Math.round(area.x) + margin;
  const minY = Math.round(area.y) + margin;
  const maxX = Math.round(area.x) + Math.round(area.width) - width - margin;
  const maxY = Math.round(area.y) + Math.round(area.height) - height - margin;

  return {
    x: clampToRange(Math.round(bounds.x), minX, maxX),
    y: clampToRange(Math.round(bounds.y), minY, maxY),
    width,
    height,
  };
}

function resolveMariaWindowBoundsAfterResize(currentBounds, requestedSize, area, options = {}) {
  const margin = normalizePositivePixelSize(options.marginPx) ?? DEFAULT_SCREEN_MARGIN_PX;
  const edgeAnchorPx = normalizePositivePixelSize(options.edgeAnchorPx) ?? DEFAULT_EDGE_ANCHOR_PX;
  const nextWidth = normalizePositivePixelSize(requestedSize.width);
  const nextHeight = normalizePositivePixelSize(requestedSize.height);
  if (nextWidth === null || nextHeight === null) {
    return null;
  }

  const rightEdge = Math.round(area.x) + Math.round(area.width) - margin;
  const bottomEdge = Math.round(area.y) + Math.round(area.height) - margin;
  const shouldAnchorRight = currentBounds.x + currentBounds.width >= rightEdge - edgeAnchorPx;
  const shouldAnchorBottom = currentBounds.y + currentBounds.height >= bottomEdge - edgeAnchorPx;

  return clampMariaWindowBounds(
    {
      x: shouldAnchorRight ? currentBounds.x + currentBounds.width - nextWidth : currentBounds.x,
      y: shouldAnchorBottom ? currentBounds.y + currentBounds.height - nextHeight : currentBounds.y,
      width: nextWidth,
      height: nextHeight,
    },
    area,
    { marginPx: margin }
  );
}

module.exports = {
  clampMariaWindowBounds,
  resolveMariaWindowBoundsAfterResize,
};
