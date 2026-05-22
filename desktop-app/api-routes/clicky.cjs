/* Minimal clicky transcription proxy to AssemblyAI */
const express = require("express");
const router = express.Router();

const ASSEMBLY_KEY = process.env.ASSEMBLYAI_API_KEY;

router.post("/transcribe", async (req, res) => {
  if (!ASSEMBLY_KEY) {
    return res.status(501).json({ error: "AssemblyAI API key not configured on desktop local server" });
  }

  try {
    const { audio } = req.body || {};
    if (!audio) {
      return res.status(400).json({ error: "Missing audio payload" });
    }

    const buffer = Buffer.from(audio, "base64");

    // Upload binary to AssemblyAI
    const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: ASSEMBLY_KEY,
        "content-type": "application/octet-stream",
      },
      body: buffer,
    });

    let uploadJson = null;
    try {
      uploadJson = await uploadRes.json();
    } catch {
      const txt = await uploadRes.text();
      if (txt && txt.startsWith("http")) {
        uploadJson = { upload_url: txt.trim() };
      }
    }

    const uploadUrl = uploadJson && (uploadJson.upload_url || uploadJson.url || uploadJson.uploadUrl);
    if (!uploadUrl) {
      return res.status(502).json({ error: "AssemblyAI upload failed", detail: uploadJson });
    }

    // Create transcription job
    const createRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: ASSEMBLY_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ audio_url: uploadUrl }),
    });

    const createJson = await createRes.json();
    const id = createJson && createJson.id;
    if (!id) {
      return res.status(502).json({ error: "Failed to create transcript", detail: createJson });
    }

    // Poll for completion
    const maxAttempts = 30;
    let attempt = 0;
    while (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 1000));
      const checkRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { authorization: ASSEMBLY_KEY },
      });
      const checkJson = await checkRes.json();
      if (checkJson.status === "completed") {
        return res.json({ text: checkJson.text });
      }
      if (checkJson.status === "failed") {
        return res.status(502).json({ error: "Transcription failed", detail: checkJson });
      }
      attempt++;
    }

    return res.status(504).json({ error: "Transcription timed out" });
  } catch (err) {
    console.error("[Clicky API] transcription error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

module.exports = router;
