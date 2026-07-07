/**
 * Helper to split long text into smaller segments with configured overlap.
 * Uses character-based splitting as a fast and reliable proxy for token counts.
 */
export function splitTextIntoChunks(
  text: string,
  chunkSize = 1000,
  overlap = 200
): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex < text.length) {
      // Find the nearest word boundary so we do not chop words in half
      const boundaryIndex = text.lastIndexOf(" ", endIndex);
      if (boundaryIndex > startIndex) {
        endIndex = boundaryIndex;
      }
    }

    const chunk = text.slice(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    startIndex = endIndex - overlap;
    if (startIndex >= text.length - overlap) {
      // If we are getting too close to the end, slice the remainder and finish
      const remainder = text.slice(endIndex - overlap).trim();
      if (remainder.length > 0 && !chunks.includes(remainder)) {
        chunks.push(remainder);
      }
      break;
    }
  }

  return chunks;
}
