import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";
import { transcribeWithWhisper } from "@/lib/maria/whisper-client";

const log = createServerLogger("AudioTranscribeRoute");

export const runtime = "nodejs";

// Max audio file size: 25 MB (Whisper limit)
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data") && !contentType.startsWith("audio/")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data or audio/* content type" },
        { status: 415 }
      );
    }

    let audioBuffer: ArrayBuffer;
    let fileName = "audio.wav";

    if (contentType.startsWith("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "No audio file in request" }, { status: 400 });
      }
      audioBuffer = await file.arrayBuffer();
      fileName = (file as File).name ?? "audio.wav";
    } else {
      // Raw audio body
      audioBuffer = await request.arrayBuffer();
    }

    if (audioBuffer.byteLength === 0) {
      return NextResponse.json({ error: "Audio buffer is empty" }, { status: 400 });
    }

    if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `Audio file exceeds maximum size of ${MAX_AUDIO_BYTES / 1024 / 1024} MB` },
        { status: 413 }
      );
    }

    log.info(`Transcription request from user ${user!.uid}, ${audioBuffer.byteLength} bytes`);

    // Try AssemblyAI if configured, otherwise fall back to Whisper.
    const assemblyAiApiKey = process.env.ASSEMBLYAI_API_KEY;

    if (assemblyAiApiKey) {
      try {
        const result = await transcribeWithAssemblyAI(audioBuffer, assemblyAiApiKey);
        return NextResponse.json({ text: result.text, provider: "assemblyai" });
      } catch (aaiErr) {
        log.warn("AssemblyAI transcription failed, falling back to Whisper:", aaiErr);
      }
    }

    const result = await transcribeWithWhisper(audioBuffer, fileName);
    return NextResponse.json({ text: result.text, provider: "whisper", duration: result.duration });
  } catch (err) {
    log.error("Transcription error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 500 }
    );
  }
}

/**
 * Transcribes audio using AssemblyAI's synchronous upload-and-transcribe flow.
 * @see https://www.assemblyai.com/docs/getting-started/transcribe-an-audio-file
 */
async function transcribeWithAssemblyAI(
  audioBuffer: ArrayBuffer,
  apiKey: string
): Promise<{ text: string }> {
  // Step 1: Upload the audio file
  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/octet-stream",
    },
    body: audioBuffer,
  });

  if (!uploadRes.ok) {
    throw new Error(`AssemblyAI upload failed: ${uploadRes.status}`);
  }

  const { upload_url } = await uploadRes.json();

  // Step 2: Request transcription
  const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ audio_url: upload_url }),
  });

  if (!transcriptRes.ok) {
    throw new Error(`AssemblyAI transcription request failed: ${transcriptRes.status}`);
  }

  const { id } = await transcriptRes.json();

  // Step 3: Poll for completion (max 60s)
  let consecutiveErrors = 0;
  for (let i = 0; i < 60; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: apiKey },
    });

    if (!pollRes.ok) {
      consecutiveErrors++;
      log.warn(`AssemblyAI polling failed with status ${pollRes.status} (consecutive: ${consecutiveErrors})`);
      if (pollRes.status === 401 || pollRes.status === 403) {
        throw new Error(`AssemblyAI credentials invalid: ${pollRes.status}`);
      }
      if (consecutiveErrors >= 5) {
        throw new Error(`AssemblyAI polling failed repeatedly with status ${pollRes.status}`);
      }
      continue;
    }

    consecutiveErrors = 0;
    const data = await pollRes.json();
    if (data.status === "completed") {
      return { text: data.text ?? "" };
    }
    if (data.status === "error") {
      throw new Error(`AssemblyAI transcription error: ${data.error}`);
    }
  }

  throw new Error("AssemblyAI transcription timed out after 60 seconds");
}
