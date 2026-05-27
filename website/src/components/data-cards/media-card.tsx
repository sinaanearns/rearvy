"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, Image as ImageIcon, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";

interface MediaCardProps {
  data: {
    ok: boolean;
    provider?: string;
    mode: "image" | "video";
    prompt: string;
    images?: string[];
    videos?: string[];
    jobId?: string;
    status?: string;
    pollingUrl?: string;
    message?: string;
  };
}

export function MediaCard({ data }: MediaCardProps) {
  const { user } = useAuth();
  const isImage = data.mode === "image";
  const [videoUrls, setVideoUrls] = useState<string[]>(data.videos || []);
  const [status, setStatus] = useState(data.status || null);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    setVideoUrls(data.videos || []);
    setStatus(data.status || null);
  }, [data.status, data.videos]);

  const canPollVideoProvider = data.provider === "openrouter";
  const providerLabel =
    data.provider === "cloudflare"
      ? "Cloudflare"
      : data.provider === "openrouter"
        ? "OpenRouter"
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
      <Card className="w-full max-w-md border-red-200 bg-red-50/20">
        <CardContent className="pt-4">
          <p className="text-sm text-red-600 font-medium">Generation Failed</p>
          <p className="text-xs text-red-500 mt-1">{data.message || "Unknown error"}</p>
        </CardContent>
      </Card>
    );
  }

  const items = isImage ? data.images || [] : videoUrls;
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

  return (
    <Card className="w-full max-w-2xl overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm shadow-xl animate-in fade-in zoom-in duration-300">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isImage ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
            {isImage ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </div>
          <CardTitle className="text-sm font-semibold">
            Generated {isImage ? "Image" : "Video"}
          </CardTitle>
          {status ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {status}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {items.map((url, idx) => (
             <Button key={idx} variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                </a>
             </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative group">
          {isImage ? (
            <div className="flex flex-col gap-2">
              {items.map((url, idx) => (
                <div key={idx} className="relative aspect-square sm:aspect-video w-full overflow-hidden bg-muted">
                  <Image
                    src={url}
                    alt={data.prompt}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {isPendingVideo ? (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 bg-black text-white sm:aspect-video">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <div className="text-center text-sm">
                    <p className="font-medium">Video is rendering</p>
                    <p className="text-xs text-white/70">
                      {data.jobId ? `${providerLabel} job ${data.jobId}` : `Waiting for ${providerLabel}`}
                    </p>
                  </div>
                </div>
              ) : isUnavailableVideo ? (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-black text-center text-white sm:aspect-video">
                  <Video className="h-5 w-5 text-white/80" />
                  <p className="text-sm font-medium">Video is not available yet</p>
                  <p className="max-w-sm px-6 text-xs text-white/70">
                    {providerLabel} did not return a playable video URL for this response.
                  </p>
                </div>
              ) : (
                items.map((url, idx) => (
                  <div key={idx} className="relative aspect-square sm:aspect-video w-full overflow-hidden bg-black">
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
        <div className="p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground italic line-clamp-2" title={data.prompt}>
            &quot;{data.prompt}&quot;
          </p>
          {pollError ? (
            <p className="mt-2 text-xs text-red-500">{pollError}</p>
          ) : data.message ? (
            <p className="mt-2 text-xs text-muted-foreground">{data.message}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
