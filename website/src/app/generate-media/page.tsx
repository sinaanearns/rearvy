"use client";

import React, { useState, useEffect } from "react";

export default function GenerateMediaPage() {
  const [mode, setMode] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("A glowing crystal-powered rocket launching from Mars");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      // revoke created object URLs when unmounting
      images.forEach((u) => URL.revokeObjectURL(u));
      videos.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [images, videos]);

  function toObjectUrlFromMaybeData(item: any, fallbackType = "image/png") {
    try {
      // data URL string
      if (typeof item === "string") return item;

      // maybe { data: number[] } or { data: { data: number[] } }
      const raw = item?.data ?? item;
      const arr = raw?.data ? raw.data : raw;
      if (Array.isArray(arr)) {
        const uint8 = new Uint8Array(arr);
        const blob = new Blob([uint8], { type: item?.mediaType || fallbackType });
        return URL.createObjectURL(blob);
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setImages([]);
    setVideos([]);

    try {
      const res = await fetch("/api/ai/generate-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, prompt, n: 1 }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Generation failed");
        setLoading(false);
        return;
      }

      if (mode === "image") {
        const imgs = json.images || [];
        const urls = imgs
          .map((it: any) => toObjectUrlFromMaybeData(it) )
          .filter(Boolean) as string[];
        setImages(urls);
      } else {
        const vids = json.videos || [];
        const urls = vids
          .map((it: any) => {
            // sometimes the provider returns a direct url field
            if (typeof it === "string" && it.startsWith("http")) return it;
            if (it?.url) return it.url;
            return toObjectUrlFromMaybeData(it, "video/mp4");
          })
          .filter(Boolean) as string[];
        setVideos(urls);
      }
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Generate Media (Grok)</h1>

      <form onSubmit={handleGenerate} style={{ display: "grid", gap: 12 }}>
        <div>
          <label>Mode: </label>
          <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>

        <div>
          <label>Prompt</label>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <button type="submit" disabled={loading}>
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </form>

      {error && <div style={{ color: "crimson", marginTop: 12 }}>{error}</div>}

      <div style={{ marginTop: 20 }}>
        {images.length > 0 && (
          <div>
            <h2>Images</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {images.map((u, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt={`generated-${i}`} style={{ maxWidth: 320 }} />
              ))}
            </div>
          </div>
        )}

        {videos.length > 0 && (
          <div>
            <h2>Videos</h2>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {videos.map((u, i) => (
                <video key={i} src={u} controls style={{ maxWidth: 480 }} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
