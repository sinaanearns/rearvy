"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_VIDEO_ASPECT_RATIO,
  MEDIA_ASPECT_RATIO_PRESETS,
  type MediaAspectRatio,
} from "@/lib/ai/media-aspect-ratio";
import { getIdToken } from "@/lib/firebase/auth";

export default function GenerateMediaPage() {
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState(
    "Create a 15 second vertical TikTok ad for a black leather wallet. Show premium closeups, fast cuts, captions, and end with \"Upgrade your everyday carry\"."
  );
  const [model, setModel] = useState("google/veo-3.1-fast");
  const [aspectRatio, setAspectRatio] = useState<MediaAspectRatio>(
    DEFAULT_IMAGE_ASPECT_RATIO
  );
  const [resolution, setResolution] = useState("720p");
  const [duration, setDuration] = useState(8);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      images.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
      videos.forEach((url) => {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, [images, videos]);

  function toObjectUrlFromMaybeData(item: any, fallbackType = "image/png") {
    try {
      if (typeof item === "string") return item;

      const raw = item?.data ?? item;
      const arr = raw?.data ? raw.data : raw;
      if (Array.isArray(arr)) {
        const uint8 = new Uint8Array(arr);
        const blob = new Blob([uint8], {
          type: item?.mediaType || fallbackType,
        });
        return URL.createObjectURL(blob);
      }

      return null;
    } catch {
      return null;
    }
  }

  async function getAuthHeaders() {
    const token = await getIdToken();

    if (!token) {
      throw new Error("Sign in before generating media.");
    }

    return { Authorization: `Bearer ${token}` };
  }

  function handleModeChange(nextMode: "image" | "video") {
    setMode(nextMode);
    setAspectRatio(
      nextMode === "image"
        ? DEFAULT_IMAGE_ASPECT_RATIO
        : DEFAULT_VIDEO_ASPECT_RATIO
    );
  }

  async function pollVideoJob(nextJobId: string, nextProvider?: string | null) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, attempt === 0 ? 5000 : 10000)
      );

      const headers = await getAuthHeaders();
      const providerQuery = nextProvider
        ? `&provider=${encodeURIComponent(nextProvider)}`
        : "";
      const res = await fetch(
        `/api/ai/generate-media?jobId=${encodeURIComponent(nextJobId)}${providerQuery}`,
        { headers }
      );
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Failed to poll video job.");
      }

      setJobStatus(json.status || "pending");

      if (json.status === "completed") {
        const urls = (json.videos || [])
          .map((it: any) => {
            if (typeof it === "string" && it.startsWith("http")) return it;
            if (it?.url) return it.url;
            return toObjectUrlFromMaybeData(it, "video/mp4");
          })
          .filter(Boolean) as string[];
        setVideos(urls);
        return;
      }

      if (["failed", "cancelled", "expired"].includes(json.status)) {
        throw new Error(json.error || `Video generation ${json.status}.`);
      }
    }

    throw new Error(
      "Video is still rendering. Try refreshing the job status in a few minutes."
    );
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setImages([]);
    setVideos([]);
    setJobId(null);
    setJobStatus(null);
    setProvider(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/ai/generate-media", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          mode,
          prompt,
          n: 1,
          model: mode === "video" ? model.trim() || undefined : undefined,
          aspect_ratio: aspectRatio,
          resolution: mode === "video" ? resolution : undefined,
          duration: mode === "video" ? duration : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Generation failed");
        setLoading(false);
        return;
      }

      if (mode === "image") {
        setProvider(json.provider || null);
        const imgs = json.images || [];
        const urls = imgs
          .map((it: any) => toObjectUrlFromMaybeData(it))
          .filter(Boolean) as string[];
        setImages(urls);
      } else {
        const responseProvider = json.provider || null;
        setProvider(responseProvider);

        if (json.jobId) {
          setJobId(json.jobId);
          setJobStatus(json.status || "pending");
        }

        const vids = json.videos || [];
        const urls = vids
          .map((it: any) => {
            if (typeof it === "string" && it.startsWith("http")) return it;
            if (it?.url) return it.url;
            return toObjectUrlFromMaybeData(it, "video/mp4");
          })
          .filter(Boolean) as string[];
        setVideos(urls);

        if (
          json.jobId &&
          json.status !== "completed" &&
          urls.length === 0 &&
          responseProvider !== "cloudflare"
        ) {
          await pollVideoJob(json.jobId, responseProvider);
        }
      }
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>Generate Media</h1>

      <form onSubmit={handleGenerate} style={{ display: "grid", gap: 12 }}>
        <div>
          <label>Mode: </label>
          <select
            value={mode}
            onChange={(e) =>
              handleModeChange(e.target.value as "image" | "video")
            }
          >
            <option value="image">Image</option>
            <option value="video">Video</option>
          </select>
        </div>

        <label>
          Ratio
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as MediaAspectRatio)}
            style={{ width: "100%" }}
          >
            {MEDIA_ASPECT_RATIO_PRESETS.filter((preset) =>
              preset.modes.includes(mode)
            ).map((preset) => (
              <option key={preset.id} value={preset.aspectRatio}>
                {preset.label} ({preset.aspectRatio}) - {preset.description}
              </option>
            ))}
          </select>
        </label>

        {mode === "video" && (
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            <label>
              Model
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="google/veo-3.1-fast"
                style={{ width: "100%" }}
              />
            </label>
            <label>
              Resolution
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="720p">720p</option>
                <option value="1080p">1080p</option>
              </select>
            </label>
            <label>
              Duration
              <input
                min={1}
                max={30}
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </label>
          </div>
        )}

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
          <button type="submit" disabled={loading || authLoading || !user}>
            {loading ? "Generating..." : "Generate"}
          </button>
          {!authLoading && !user ? (
            <span style={{ marginLeft: 12, color: "crimson" }}>
              Sign in to generate media.
            </span>
          ) : null}
        </div>
      </form>

      {jobId && (
        <div style={{ marginTop: 12, fontSize: 14 }}>
          {(provider || "Media").replace(/^\w/, (char) => char.toUpperCase())} job: <code>{jobId}</code>
          {jobStatus ? ` (${jobStatus})` : null}
        </div>
      )}

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
