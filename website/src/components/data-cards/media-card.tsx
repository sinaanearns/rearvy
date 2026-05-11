"use client";

import React from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, ExternalLink, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MediaCardProps {
  data: {
    ok: boolean;
    mode: "image" | "video";
    prompt: string;
    images?: string[];
    videos?: string[];
    message?: string;
  };
}

export function MediaCard({ data }: MediaCardProps) {
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

  const isImage = data.mode === "image";
  const items = isImage ? data.images || [] : data.videos || [];

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
              {items.map((url, idx) => (
                <div key={idx} className="relative aspect-square sm:aspect-video w-full overflow-hidden bg-black">
                  <video
                    src={url}
                    controls
                    className="h-full w-full object-contain"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-4 bg-muted/30">
          <p className="text-xs text-muted-foreground italic line-clamp-2" title={data.prompt}>
            &quot;{data.prompt}&quot;
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
