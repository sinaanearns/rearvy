"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import { DataCardFrame, DataCardMessage } from "./data-card-frame";

interface MediaCardProps {
  data: {
    ok: boolean;
    provider?: string;
    mode: "image" | "image-edit" | "video";
    prompt: string;
    aspectRatio?: string;
    images?: string[];
    videos?: string[];
    jobId?: string;
    status?: string;
    pollingUrl?: string;
    message?: string;
    presentation?: "design";
    originalPrompt?: string;
    designSummary?: string;
  };
}

function getImageFileName(prompt: string, index: number, url: string) {
  const fallbackExtension = "png";
  const dataTypeMatch = url.match(/^data:image\/([a-z0-9.+-]+);/i);
  const urlExtensionMatch = url.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  const extension =
    dataTypeMatch?.[1]?.replace("jpeg", "jpg") ||
    urlExtensionMatch?.[1] ||
    fallbackExtension;
  const slug =
    prompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "generated-image";

  return `${slug}-${index + 1}.${extension}`;
}

async function downloadImage(url: string, fileName: string) {
  let downloadUrl = url;
  let shouldRevoke = false;

  try {
    if (!url.startsWith("data:") && !url.startsWith("blob:")) {
      const response = await fetch(url);
      if (response.ok) {
        const blob = await response.blob();
        downloadUrl = URL.createObjectURL(blob);
        shouldRevoke = true;
      }
    }
  } catch {
    downloadUrl = url;
  }

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = fileName;
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();

  if (shouldRevoke) {
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }
}

function getFrameAspectRatio(value: string | undefined, isImage: boolean) {
  const match = value?.match(/^([1-9]\d?):([1-9]\d?)$/);
  if (!match) {
    return isImage ? "4 / 5" : "16 / 9";
  }

  return `${Number(match[1])} / ${Number(match[2])}`;
}

export function MediaCard({ data }: MediaCardProps) {
  const { user } = useAuth();
  const isImage = data.mode === "image" || data.mode === "image-edit";
  const [videoUrls, setVideoUrls] = useState<string[]>(data.videos || []);
  const [status, setStatus] = useState(data.status || null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(
    null
  );

  useEffect(() => {
    setVideoUrls(data.videos || []);
    setStatus(data.status || null);
  }, [data.status, data.videos]);

  const canPollVideoProvider = data.provider === "openrouter";
  const providerLabel =
    data.provider === "openrouter"
      ? "OpenRouter"
      : data.provider === "nvidia"
        ? "NVIDIA"
        : "media";

  const refreshVideoJob = useCallback(async () => {
    if (!data.jobId || !canPollVideoProvider) {
      return null;
    }

    const token = await getIdToken();

    if (!token) {
      throw new Error("Sign in to refresh the video job.");
    }

    const response = await fetch(
      `/api/ai/generate-media?jobId=${encodeURIComponent(data.jobId)}&provider=${encodeURIComponent(data.provider || "")}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json?.error || "Failed to refresh video job.");
    }

    setStatus(json.status || "pending");

    if (Array.isArray(json.videos) && json.videos.length > 0) {
      setVideoUrls(json.videos.filter((url: unknown): url is string => typeof url === "string"));
    }

    return json;
  }, [canPollVideoProvider, data.jobId, data.provider, user]);

  useEffect(() => {
    if (
      isImage ||
      !canPollVideoProvider ||
      !data.jobId ||
      videoUrls.length > 0 ||
      ["completed", "failed", "cancelled", "expired"].includes(status || "")
    ) {
      return;
    }

    let active = true;
    let timer: number | null = null;

    const poll = async () => {
      try {
        const json = await refreshVideoJob();

        if (!active) return;

        if (json && ["failed", "cancelled", "expired"].includes(json.status)) {
          setPollError(json.error || `Video generation ${json.status}.`);
          return;
        }

        if (!json || json.status !== "completed") {
          timer = window.setTimeout(poll, 10000);
        }
      } catch (error) {
        if (active) {
          setPollError(error instanceof Error ? error.message : "Failed to poll video job.");
        }
      }
    };

    timer = window.setTimeout(poll, 5000);

    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [
    data.jobId,
    data.provider,
    canPollVideoProvider,
    isImage,
    refreshVideoJob,
    status,
    videoUrls.length,
  ]);

  if (!data.ok) {
    return (
      <DataCardMessage
        icon={AlertCircle}
        title="Generation failed"
        tone="rose"
        message={data.message || "Unknown error"}
      />
    );
  }

  const items = isImage ? data.images || [] : videoUrls;
  const selectedImageUrl =
    selectedImageIndex !== null ? items[selectedImageIndex] : null;
  const frameStyle = {
    aspectRatio: getFrameAspectRatio(data.aspectRatio, isImage),
  };
  const isPendingVideo =
    !isImage &&
    canPollVideoProvider &&
    items.length === 0 &&
    !["failed", "cancelled", "expired"].includes(status || "");
  const isUnavailableVideo =
    !isImage &&
    !canPollVideoProvider &&
    items.length === 0 &&
    Boolean(status) &&
    !["completed", "failed", "cancelled", "expired"].includes(status || "");
  const isDesignPresentation = isImage && data.presentation === "design";
  const MediaIcon = isImage ? ImageIcon : Video;
  const cardTitle =
    data.mode === "image-edit"
      ? "Edited image"
      : `Generated ${isImage ? "image" : "video"}`;

  if (isDesignPresentation) {
    const summaryParagraphs = (data.designSummary || "")
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    return (
      <div className="w-full max-w-3xl animate-in fade-in duration-300">
        {summaryParagraphs.length > 0 ? (
          <div className="max-w-3xl space-y-4 text-[15px] leading-7 text-foreground sm:text-base sm:leading-8">
            {summaryParagraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {items.length > 0 ? (
            items.map((url, index) => (
              <a
                key={`${url}-${index}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block h-60 w-60 overflow-hidden rounded-[8px] border border-border/70 bg-muted shadow-sm outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Open generated design ${index + 1}`}
              >
                <Image
                  src={url}
                  alt={data.prompt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="240px"
                  unoptimized
                />
              </a>
            ))
          ) : (
            <div className="flex h-40 w-60 items-center justify-center rounded-[8px] border border-dashed border-border/70 bg-muted/40 text-sm text-muted-foreground">
              No task file returned.
            </div>
          )}
        </div>

        <div className="mt-6 border-t border-border/70 pt-6">
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            Task files
          </h3>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {items[0] ? (
              <a
                href={items[0]}
                target="_blank"
                rel="noopener noreferrer"
                className="relative h-[70px] w-[70px] overflow-hidden rounded-[8px] bg-muted outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Open generated design file"
              >
                <Image
                  src={items[0]}
                  alt={data.prompt}
                  fill
                  className="object-cover"
                  sizes="70px"
                  unoptimized
                />
              </a>
            ) : null}
            <button
              type="button"
              disabled={items.length === 0}
              onClick={() => {
                items.forEach((url, index) => {
                  void downloadImage(url, getImageFileName(data.prompt, index, url));
                });
              }}
              className="inline-flex h-[70px] items-center gap-2 rounded-[8px] bg-muted px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>All files ({items.length})</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DataCardFrame
      icon={MediaIcon}
      title={cardTitle}
      subtitle={`Rendered with ${providerLabel}`}
      tone={isImage ? "cyan" : "violet"}
      className="max-w-2xl animate-in fade-in zoom-in duration-300"
      accessory={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {status ? (
            <span className="rounded-[8px] bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {status}
            </span>
          ) : null}
          {data.aspectRatio ? (
            <span className="rounded-[8px] bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {data.aspectRatio}
            </span>
          ) : null}
          {items.map((url, idx) =>
            isImage ? (
              <React.Fragment key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`View generated image ${idx + 1} fullscreen`}
                      onClick={() => setSelectedImageIndex(idx)}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View fullscreen</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Download generated image ${idx + 1}`}
                      onClick={() =>
                        void downloadImage(
                          url,
                          getImageFileName(data.prompt, idx, url)
                        )
                      }
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open generated image ${idx + 1} in new tab`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open in new tab</TooltipContent>
                </Tooltip>
              </React.Fragment>
            ) : (
              <Button
                key={idx}
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                asChild
              >
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )
          )}
        </div>
      }
    >
        <div className="relative group">
          {isImage ? (
            <div className="flex flex-col gap-2">
              {items.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="relative w-full overflow-hidden bg-muted text-left outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-ring"
                  style={frameStyle}
                  aria-label={`View generated image ${idx + 1} fullscreen`}
                  onClick={() => setSelectedImageIndex(idx)}
                >
                  <Image
                    src={url}
                    alt={data.prompt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {isPendingVideo ? (
                <div
                  className="flex w-full flex-col items-center justify-center gap-3 bg-black text-white"
                  style={frameStyle}
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <div className="text-center text-sm">
                    <p className="font-medium">Video is rendering</p>
                    <p className="text-xs text-white/70">
                      {data.jobId ? `${providerLabel} job ${data.jobId}` : `Waiting for ${providerLabel}`}
                    </p>
                  </div>
                </div>
              ) : isUnavailableVideo ? (
                <div
                  className="flex w-full flex-col items-center justify-center gap-2 bg-black text-center text-white"
                  style={frameStyle}
                >
                  <Video className="h-5 w-5 text-white/80" />
                  <p className="text-sm font-medium">Video is not available yet</p>
                  <p className="max-w-sm px-6 text-xs text-white/70">
                    {providerLabel} did not return a playable video URL for this response.
                  </p>
                </div>
              ) : (
                items.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative w-full overflow-hidden bg-black"
                    style={frameStyle}
                  >
                    <video
                      src={url}
                      controls
                      className="h-full w-full object-contain"
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="rounded-[8px] border border-border/70 bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground italic line-clamp-2" title={data.prompt}>
            &quot;{data.prompt}&quot;
          </p>
          {pollError ? (
            <p className="mt-2 text-xs text-red-500">{pollError}</p>
          ) : data.message ? (
            <p className="mt-2 text-xs text-muted-foreground">{data.message}</p>
          ) : null}
        </div>
      <Dialog
        open={Boolean(selectedImageUrl)}
        onOpenChange={(open) => {
          if (!open) setSelectedImageIndex(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="fixed inset-0 left-0 top-0 h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr] gap-0 rounded-none border-0 bg-black p-0 text-white shadow-none sm:max-w-none"
        >
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-white/10 bg-black/80 px-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-sm font-semibold text-white">
                Generated Image
              </DialogTitle>
              <DialogDescription className="truncate text-xs text-white/60">
                {selectedImageIndex !== null
                  ? getImageFileName(
                      data.prompt,
                      selectedImageIndex,
                      selectedImageUrl || ""
                    )
                  : "Generated image"}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1">
              {selectedImageUrl && selectedImageIndex !== null ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
                        aria-label="Download generated image"
                        onClick={() =>
                          void downloadImage(
                            selectedImageUrl,
                            getImageFileName(
                              data.prompt,
                              selectedImageIndex,
                              selectedImageUrl
                            )
                          )
                        }
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
                        asChild
                      >
                        <a
                          href={selectedImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open generated image in new tab"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open in new tab</TooltipContent>
                  </Tooltip>
                </>
              ) : null}
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-white hover:bg-white/10 hover:text-white"
                  aria-label="Close fullscreen image"
                >
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>
          </div>
          <div className="relative min-h-0 bg-black">
            {selectedImageUrl ? (
              <Image
                src={selectedImageUrl}
                alt={data.prompt}
                fill
                className="object-contain"
                sizes="100vw"
                unoptimized
                priority
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </DataCardFrame>
  );
}
