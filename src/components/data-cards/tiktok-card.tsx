"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Music2 } from "lucide-react";

interface TikTokCardProps {
  data: {
    displayName?: string;
    followerCount?: number;
    followingCount?: number;
    totalLikes?: number;
    videoCount?: number;
    videos?: Array<{
      title?: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      engagementRate?: number;
      createdAt?: string;
      shareUrl?: string;
    }>;
    videoId?: string;
    title?: string;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    engagementRate?: number;
    message?: string;
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function TikTokCard({ data }: TikTokCardProps) {
  if (data.message && !data.videos && !data.displayName && !data.videoId) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground italic">{data.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Account stats view
  if (data.displayName !== undefined || data.followerCount !== undefined) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Music2 className="h-4 w-4" />
            TikTok Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.displayName && (
            <p className="text-sm font-medium mb-3">{data.displayName}</p>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold">
                {formatNumber(data.followerCount ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatNumber(data.totalLikes ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total likes</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatNumber(data.videoCount ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Videos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Video list view
  if (data.videos && data.videos.length > 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Music2 className="h-4 w-4" />
            TikTok Videos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.videos.slice(0, 5).map((video, i) => (
            <div key={i} className="border-b last:border-0 pb-2 last:pb-0">
              <p className="text-sm truncate font-medium">
                {video.title || "Untitled"}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{formatNumber(video.views)} views</span>
                <span>{formatNumber(video.likes)} likes</span>
                <span>{formatNumber(video.comments)} comments</span>
                <span>{formatNumber(video.shares)} shares</span>
              </div>
              {video.engagementRate !== undefined && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {video.engagementRate.toFixed(1)}% engagement
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Single video detail view
  if (data.videoId || data.title) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Music2 className="h-4 w-4" />
            TikTok Video
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium mb-3">{data.title || "Untitled"}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xl font-bold">
                {formatNumber(data.views ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>
            <div>
              <p className="text-xl font-bold">
                {formatNumber(data.likes ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Likes</p>
            </div>
            <div>
              <p className="text-xl font-bold">
                {formatNumber(data.comments ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Comments</p>
            </div>
            <div>
              <p className="text-xl font-bold">
                {formatNumber(data.shares ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Shares</p>
            </div>
          </div>
          {data.engagementRate !== undefined && (
            <div className="border-t pt-3 mt-3">
              <p className="text-lg font-semibold">
                {data.engagementRate.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">Engagement rate</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
