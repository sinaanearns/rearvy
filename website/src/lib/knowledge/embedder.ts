import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Knowledge:Embedder");

/**
 * Generates vector embeddings for a given text using OpenAI or OpenAI-compatible endpoint.
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.NVIDIA_API_KEY || "";
  const baseURL = process.env.NVIDIA_EMBEDDINGS_BASE_URL || "https://integrate.api.nvidia.com/v1";
  const model = process.env.EMBEDDING_MODEL || "nvidia/llama-3.2-nv-embed-1b";

  if (!apiKey) {
    log.warn("No API key configured for embedding generation. Returning zero vector.");
    return new Array(2048).fill(0); // 2048 is standard nvidia/llama-3.2-nv-embed-1b size
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
        model,
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
