import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Knowledge:Embedder");

export type EmbeddingInputType = "passage" | "query";

interface EmbeddingResponse {
  data?: Array<{ embedding?: unknown }>;
}

/**
 * Generates an NVIDIA retrieval embedding. Passage and query embeddings must
 * use their respective modes, otherwise retrieval quality degrades sharply.
 */
export async function getEmbedding(
  text: string,
  inputType: EmbeddingInputType
): Promise<number[] | null> {
  const apiKey = process.env.NVIDIA_API_KEY || "";
  const baseURL = process.env.NVIDIA_EMBEDDINGS_BASE_URL || "https://integrate.api.nvidia.com/v1";
  const model = process.env.EMBEDDING_MODEL || "nvidia/nv-embed-v1";

  if (!apiKey) {
    log.warn("No NVIDIA_API_KEY configured for embedding generation. Skipping vector retrieval.");
    return null;
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
        input_type: inputType,
        encoding_format: "float",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Embedding request failed: ${response.status} ${errText}`);
    }

    const payload = (await response.json()) as EmbeddingResponse;
    const embedding = payload.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0 || !embedding.every(Number.isFinite)) {
      throw new Error("Embedding response did not contain a valid numeric vector.");
    }

    return embedding;
  } catch (error) {
    log.error("Failed to generate embedding", error);
    return null;
  }
}
