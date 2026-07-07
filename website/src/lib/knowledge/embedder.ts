import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Knowledge:Embedder");

/**
 * Generates vector embeddings for a given text using OpenAI or OpenAI-compatible endpoint.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.TOGETHER_API_KEY || "";
  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    log.warn("No API key configured for embedding generation. Returning zero vector.");
    return new Array(1536).fill(0); // 1536 is standard text-embedding-ada-002 size
  }

  try {
    const response = await fetch(`${baseURL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text.replace(/\n/g, " "),
        model: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Embedding request failed: ${response.status} ${errText}`);
    }

    const payload = await response.json();
    return payload.data[0].embedding;
  } catch (error) {
    log.error("Failed to generate embedding", error);
    // Return dummy vector on failure so execution doesn't fully halt
    return new Array(1536).fill(0);
  }
}
