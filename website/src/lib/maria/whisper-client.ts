import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Whisper:Client");

export interface WhisperTranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

/**
 * Transcribes audio using the OpenAI Whisper API as a fallback when AssemblyAI is unavailable.
 * Expects a raw audio file buffer (wav, mp3, ogg, etc.)
 */
export async function transcribeWithWhisper(
  audioBuffer: ArrayBuffer,
  fileName = "audio.wav"
): Promise<WhisperTranscriptionResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured — Audio transcription is unavailable.");
  }

  log.info(`Transcribing audio (${audioBuffer.byteLength} bytes) via NVIDIA Canary/Whisper NIM`);

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: "audio/wav" });
  formData.append("file", blob, fileName);
  formData.append("model", "nvidia/canary-1b");
  formData.append("response_format", "json");

  const response = await fetch("https://integrate.api.nvidia.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Whisper transcription failed: ${response.status} ${errText}`);
  }

  const payload = await response.json();
  log.info("Whisper transcription complete.");

  return {
    text: payload.text || "",
    language: payload.language,
    duration: payload.duration,
  };
}
