"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Brush,
  Clapperboard,
  ImageIcon,
  Loader2,
  LockKeyhole,
  MonitorPlay,
  Palette,
  Scissors,
  Sparkles,
  Upload,
  Video,
  WandSparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  DEFAULT_IMAGE_ASPECT_RATIO,
  DEFAULT_VIDEO_ASPECT_RATIO,
  MEDIA_ASPECT_RATIO_PRESETS,
  type MediaAspectRatio,
} from "@/lib/ai/media-aspect-ratio";
import { getIdToken } from "@/lib/firebase/auth";
import { getErrorMessage } from "@/lib/error-utils";

type MediaMode = "image" | "image-edit" | "video";

type MediaModeOption = {
  id: MediaMode;
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string;
};

type GenerateMediaResponse = {
  error?: string;
  provider?: string | null;
  images?: unknown;
  videos?: unknown;
  jobId?: string;
  status?: string;
};

const mediaModes: MediaModeOption[] = [
  {
    id: "image",
    label: "Image",
    description: "Fresh campaign visuals",
    icon: WandSparkles,
    accent: "text-[#69d7ff]",
  },
  {
    id: "image-edit",
    label: "Image edit",
    description: "Upload and refine",
    icon: Scissors,
    accent: "text-[#7de7c7]",
  },
  {
    id: "video",
    label: "Video",
    description: "Motion-ready ad concepts",
    icon: Video,
    accent: "text-[#f7c948]",
  },
];

const productionNotes = [
  {
    title: "Prompt system",
    detail: "NVIDIA image and video routes keep output inside the Rearvy workflow.",
    icon: Sparkles,
  },
  {
    title: "Aspect lock",
    detail: "Use preset ratios for social, product, and widescreen formats.",
    icon: MonitorPlay,
  },
  {
    title: "Review output",
    detail: "Generated media appears here first so it can be inspected before reuse.",
    icon: BadgeCheck,
  },
];

function formatProvider(value: string | null) {
  if (!value) {
    return "Provider pending";
  }

  return value.replace(/^\w/, (char) => char.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function GenerateMediaPage() {
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<MediaMode>("image");
  const [prompt, setPrompt] = useState(
    'Create a 15 second vertical TikTok ad for a black leather wallet. Show premium closeups, fast cuts, captions, and end with "Upgrade your everyday carry".'
  );
  const [model, setModel] = useState("nvidia/cosmos-predict1-7b");
  const [imageEditModel, setImageEditModel] = useState("qwen-image-edit-2511");
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editImageName, setEditImageName] = useState("");
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

  const activeMode = mediaModes.find((item) => item.id === mode) ?? mediaModes[0];
  const ActiveModeIcon = activeMode.icon;
  const ratioOptions = MEDIA_ASPECT_RATIO_PRESETS.filter((preset) =>
    preset.modes.includes(mode === "video" ? "video" : "image")
  );
  const hasOutput = images.length > 0 || videos.length > 0;
  const canGenerate = !loading && !authLoading && Boolean(user);

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

  function toObjectUrlFromMaybeData(item: unknown, fallbackType = "image/png") {
    try {
      if (typeof item === "string") return item;

      const raw = isRecord(item) && "data" in item ? item.data : item;
      const arr = isRecord(raw) && "data" in raw ? raw.data : raw;
      if (Array.isArray(arr)) {
        const uint8 = new Uint8Array(arr);
        const blob = new Blob([uint8], {
          type:
            isRecord(item) && typeof item.mediaType === "string"
              ? item.mediaType
              : fallbackType,
        });
        return URL.createObjectURL(blob);
      }

      return null;
    } catch {
      return null;
    }
  }

  function toVideoUrl(item: unknown) {
    if (typeof item === "string" && item.startsWith("http")) return item;
    if (isRecord(item) && typeof item.url === "string") return item.url;
    return toObjectUrlFromMaybeData(item, "video/mp4");
  }

  function mapMediaUrls(items: unknown, mapper: (item: unknown) => string | null) {
    return Array.isArray(items)
      ? items.map(mapper).filter((url): url is string => Boolean(url))
      : [];
  }

  async function getAuthHeaders() {
    const token = await getIdToken();

    if (!token) {
      throw new Error("Sign in before generating media.");
    }

    return { Authorization: `Bearer ${token}` };
  }

  function handleModeChange(nextMode: MediaMode) {
    setMode(nextMode);
    setAspectRatio(
      nextMode === "video" ? DEFAULT_VIDEO_ASPECT_RATIO : DEFAULT_IMAGE_ASPECT_RATIO
    );
  }

  function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("Could not read image file."));
      };
      reader.onerror = () =>
        reject(reader.error || new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });
  }

  async function handleEditImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Select an image file to edit.");
      return;
    }

    setEditImage(await readFileAsDataUrl(file));
    setEditImageName(file.name);
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
      const json = (await res.json()) as GenerateMediaResponse;

      if (!res.ok) {
        throw new Error(json?.error || "Failed to poll video job.");
      }

      const nextStatus = json.status || "pending";
      setJobStatus(nextStatus);

      if (nextStatus === "completed") {
        const urls = mapMediaUrls(json.videos, toVideoUrl);
        setVideos(urls);
        return;
      }

      if (["failed", "cancelled", "expired"].includes(nextStatus)) {
        throw new Error(json.error || `Video generation ${nextStatus}.`);
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
      if (mode === "image-edit" && !editImage) {
        setError("Upload an image to edit.");
        setLoading(false);
        return;
      }

      const headers = await getAuthHeaders();
      const res = await fetch("/api/ai/generate-media", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          mode,
          prompt,
          n: 1,
          model:
            mode === "video"
              ? model.trim() || undefined
              : mode === "image-edit"
                ? imageEditModel.trim() || undefined
                : undefined,
          inputImages: mode === "image-edit" && editImage ? [editImage] : undefined,
          aspect_ratio: aspectRatio,
          resolution: mode === "video" ? resolution : undefined,
          duration: mode === "video" ? duration : undefined,
        }),
      });
      const json = (await res.json()) as GenerateMediaResponse;
      if (!res.ok) {
        setError(json?.error || "Generation failed");
        setLoading(false);
        return;
      }

      if (mode === "image" || mode === "image-edit") {
        setProvider(json.provider || null);
        const urls = mapMediaUrls(json.images, (item) => toObjectUrlFromMaybeData(item));
        setImages(urls);
      } else {
        const responseProvider = json.provider || null;
        setProvider(responseProvider);

        if (json.jobId) {
          setJobId(json.jobId);
          setJobStatus(json.status || "pending");
        }

        const urls = mapMediaUrls(json.videos, toVideoUrl);
        setVideos(urls);

        if (
          json.jobId &&
          json.status !== "completed" &&
          urls.length === 0
        ) {
          await pollVideoJob(json.jobId, responseProvider);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, "Generation failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030405] text-white selection:bg-[#69d7ff] selection:text-black">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[linear-gradient(116deg,rgba(105,215,255,0.18),transparent_30%),linear-gradient(248deg,rgba(247,201,72,0.12),transparent_35%),repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_78px),repeating-linear-gradient(0deg,rgba(255,255,255,0.022)_0_1px,transparent_1px_78px)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(125,231,199,0.18),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.88))]"
      />

      <section className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1500px] gap-6 px-5 py-6 sm:px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(420px,0.7fr)] lg:items-start">
        <div className="min-w-0 pt-6 lg:pt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.07] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-white/68 backdrop-blur-xl">
            <Palette className="h-3.5 w-3.5 text-[#69d7ff]" aria-hidden />
            Media production
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(340px,0.52fr)] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-balance text-[clamp(34px,6vw,78px)] font-semibold leading-[0.95] tracking-normal">
                Generate sharper creative inside Rearvy.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                Build image, edit, and video outputs from the same workspace where prompts,
                source context, and approval already live.
              </p>
            </div>

            <div className="hidden gap-3 lg:grid">
              {productionNotes.map((note) => {
                const Icon = note.icon;

                return (
                  <div
                    key={note.title}
                    className="grid min-h-[86px] grid-cols-[38px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-white/12 bg-white/[0.06] p-3 backdrop-blur-xl"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 text-[#69d7ff]">
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{note.title}</p>
                      <p className="mt-1 text-xs leading-5 text-white/52">{note.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={handleGenerate}
            className="mt-6 rounded-[8px] border border-white/12 bg-black/48 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-5"
          >
            <div className="grid gap-3 md:grid-cols-3">
              {mediaModes.map((option) => {
                const Icon = option.icon;
                const isActive = option.id === mode;

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => handleModeChange(option.id)}
                    className={
                      isActive
                        ? "group grid min-h-[112px] gap-3 rounded-[8px] border border-[#69d7ff]/55 bg-[#69d7ff]/12 p-4 text-left shadow-[0_18px_54px_rgba(47,128,255,0.18)] transition"
                        : "group grid min-h-[112px] gap-3 rounded-[8px] border border-white/10 bg-white/[0.045] p-4 text-left transition hover:border-white/22 hover:bg-white/[0.08]"
                    }
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 ${option.accent}`}>
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      {isActive ? <Zap className="h-4 w-4 text-[#f7c948]" aria-hidden /> : null}
                    </span>
                    <span>
                      <span className="block text-base font-semibold text-white">{option.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-white/54">{option.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.62fr)_minmax(0,0.38fr)]">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                  Prompt
                </span>
                <textarea
                  rows={8}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  className="min-h-[220px] resize-y rounded-[8px] border border-white/12 bg-white/[0.06] p-4 text-sm leading-6 text-white outline-none transition placeholder:text-white/34 focus:border-[#69d7ff]/70 focus:bg-white/[0.08]"
                />
              </label>

              <div className="grid content-start gap-4">
                <label className="grid gap-2">
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                    Ratio
                  </span>
                  <select
                    value={aspectRatio}
                    onChange={(event) => setAspectRatio(event.target.value as MediaAspectRatio)}
                    className="min-h-12 rounded-[8px] border border-white/12 bg-[#080b0d] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#69d7ff]/70"
                  >
                    {ratioOptions.map((preset) => (
                      <option key={preset.id} value={preset.aspectRatio}>
                        {preset.label} ({preset.aspectRatio})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs leading-5 text-white/46">
                    {ratioOptions.find((preset) => preset.aspectRatio === aspectRatio)?.description}
                  </span>
                </label>

                {mode === "video" ? (
                  <div className="grid gap-3 rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
                    <label className="grid gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                        Model
                      </span>
                      <input
                        value={model}
                        onChange={(event) => setModel(event.target.value)}
                        placeholder="nvidia/cosmos-predict1-7b"
                        className="min-h-11 rounded-[8px] border border-white/12 bg-black/34 px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#f7c948]/70"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                          Resolution
                        </span>
                        <select
                          value={resolution}
                          onChange={(event) => setResolution(event.target.value)}
                          className="min-h-11 rounded-[8px] border border-white/12 bg-[#080b0d] px-3 text-sm text-white outline-none transition focus:border-[#f7c948]/70"
                        >
                          <option value="720p">720p</option>
                          <option value="1080p">1080p</option>
                        </select>
                      </label>
                      <label className="grid gap-2">
                        <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                          Duration
                        </span>
                        <input
                          min={1}
                          max={30}
                          type="number"
                          value={duration}
                          onChange={(event) => setDuration(Number(event.target.value))}
                          className="min-h-11 rounded-[8px] border border-white/12 bg-black/34 px-3 text-sm text-white outline-none transition focus:border-[#f7c948]/70"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {mode === "image-edit" ? (
                  <div className="grid gap-3 rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
                    <label className="grid gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                        Edit model
                      </span>
                      <input
                        value={imageEditModel}
                        onChange={(event) => setImageEditModel(event.target.value)}
                        placeholder="qwen-image-edit-2511"
                        className="min-h-11 rounded-[8px] border border-white/12 bg-black/34 px-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#7de7c7]/70"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">
                        Input image
                      </span>
                      <span className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-dashed border-white/18 bg-black/24 px-3 text-sm font-semibold text-white/72 transition hover:border-[#7de7c7]/60 hover:text-white">
                        <Upload className="h-4 w-4" aria-hidden />
                        {editImageName || "Upload image"}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleEditImageChange}
                          className="sr-only"
                        />
                      </span>
                    </label>
                    {editImage ? (
                      <div className="overflow-hidden rounded-[8px] border border-white/10 bg-black/28">
                        <Image
                          src={editImage}
                          alt=""
                          width={320}
                          height={220}
                          unoptimized
                          className="h-40 w-full object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canGenerate}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-bold text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-white/45"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ActiveModeIcon className="h-4 w-4" aria-hidden />}
                  {loading ? "Generating..." : `Generate ${activeMode.label.toLowerCase()}`}
                </button>

                {!authLoading && !user ? (
                  <div className="rounded-[8px] border border-[#f7c948]/24 bg-[#f7c948]/10 p-3 text-sm leading-6 text-white/70">
                    <div className="flex items-start gap-2">
                      <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#f7c948]" aria-hidden />
                      <p>
                        Sign in before generating media.{" "}
                        <Link href="/login?redirect=/generate-media" className="font-semibold text-white underline-offset-4 hover:underline">
                          Open login
                        </Link>
                      </p>
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-[8px] border border-red-300/24 bg-red-300/10 p-3 text-sm leading-6 text-red-50">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          </form>
        </div>

        <aside className="min-w-0 pt-0 lg:sticky lg:top-6 lg:pt-12">
          <div className="rounded-[8px] border border-white/12 bg-black/50 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.44)] backdrop-blur-xl sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/48">
                  Production status
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Output stage</h2>
              </div>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 ${activeMode.accent}`}>
                <ActiveModeIcon className="h-5 w-5" aria-hidden />
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="grid min-h-[72px] grid-cols-[36px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.055] p-3">
                <ImageIcon className="h-5 w-5 text-[#69d7ff]" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{activeMode.label}</p>
                  <p className="mt-1 text-xs text-white/48">{activeMode.description}</p>
                </div>
              </div>
              <div className="grid min-h-[72px] grid-cols-[36px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-white/10 bg-white/[0.055] p-3">
                <Brush className="h-5 w-5 text-[#7de7c7]" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{formatProvider(provider)}</p>
                  <p className="mt-1 text-xs text-white/48">
                    {jobStatus ? `Job status: ${jobStatus}` : "Ready for the next generation"}
                  </p>
                </div>
              </div>
              {jobId ? (
                <div className="rounded-[8px] border border-white/10 bg-black/34 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">
                    Job id
                  </p>
                  <code className="mt-2 block break-all font-mono text-xs leading-5 text-white/68">
                    {jobId}
                  </code>
                </div>
              ) : null}
            </div>

            <div className="mt-5 overflow-hidden rounded-[8px] border border-white/12 bg-white/[0.055]">
              <div className="flex min-h-12 items-center justify-between gap-3 border-b border-white/10 px-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Clapperboard className="h-4 w-4 text-[#f7c948]" aria-hidden />
                  Preview
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-white/42">
                  {images.length + videos.length} asset{images.length + videos.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="min-h-[360px] p-3">
                {hasOutput ? (
                  <div className="grid gap-3">
                    {images.map((url, index) => (
                      <div key={`${url}-${index}`} className="overflow-hidden rounded-[8px] border border-white/10 bg-black/40">
                        <Image
                          src={url}
                          alt={`Generated image ${index + 1}`}
                          width={720}
                          height={720}
                          unoptimized
                          className="h-auto w-full object-contain"
                        />
                      </div>
                    ))}
                    {videos.map((url, index) => (
                      <video
                        key={`${url}-${index}`}
                        src={url}
                        controls
                        className="w-full overflow-hidden rounded-[8px] border border-white/10 bg-black"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-[330px] place-items-center rounded-[8px] border border-dashed border-white/12 bg-black/24 p-6 text-center">
                    <div>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 text-[#69d7ff]">
                        <ActiveModeIcon className="h-6 w-6" aria-hidden />
                      </div>
                      <h3 className="mt-5 text-xl font-semibold text-white">Waiting for output</h3>
                      <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/54">
                        Generated images and videos will appear in this review stage.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
