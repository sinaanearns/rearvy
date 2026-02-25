"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Instagram } from "lucide-react";

interface InstagramCardProps {
  data: {
    username?: string;
    followers?: number;
    following?: number;
    mediaCount?: number;
    periodImpressions?: number;
    periodReach?: number;
    periodProfileViews?: number;
    posts?: Array<{
      caption?: string;
      mediaType?: string;
      likes: number;
      comments: number;
      reach?: number;
      engagementRate?: number;
      postedAt?: string;
      permalink?: string;
    }>;
    videos?: Array<unknown>;
    comments?: Array<{
      text: string;
      username: string;
      postCaption?: string;
      likes?: number;
    }>;
    message?: string;
  };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function InstagramCard({ data }: InstagramCardProps) {
  if (data.message && !data.posts && !data.username && !data.comments) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground italic">{data.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Account stats view
  if (data.username !== undefined || data.followers !== undefined) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Instagram className="h-4 w-4" />
            Instagram Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.username && (
            <p className="text-sm font-medium mb-3">@{data.username}</p>
          )}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <p className="text-2xl font-bold">
                {formatNumber(data.followers ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatNumber(data.following ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Following</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {formatNumber(data.mediaCount ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">Posts</p>
            </div>
          </div>
          {(data.periodImpressions || data.periodReach) && (
            <div className="border-t pt-3 grid grid-cols-3 gap-4">
              <div>
                <p className="text-lg font-semibold">
                  {formatNumber(data.periodImpressions ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Impressions</p>
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {formatNumber(data.periodReach ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Reach</p>
              </div>
              <div>
                <p className="text-lg font-semibold">
                  {formatNumber(data.periodProfileViews ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground">Profile views</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Posts list view
  if (data.posts && data.posts.length > 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Instagram className="h-4 w-4" />
            Instagram Posts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.posts.slice(0, 5).map((post, i) => (
            <div key={i} className="border-b last:border-0 pb-2 last:pb-0">
              <p className="text-sm truncate">
                {post.caption || "No caption"}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{formatNumber(post.likes)} likes</span>
                <span>{formatNumber(post.comments)} comments</span>
                {post.reach && <span>{formatNumber(post.reach)} reach</span>}
                {post.engagementRate !== undefined && (
                  <span>{post.engagementRate.toFixed(1)}% eng.</span>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Comments view
  if (data.comments && data.comments.length > 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Instagram className="h-4 w-4" />
            Instagram Comments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.comments.slice(0, 5).map((comment, i) => (
            <div key={i} className="border-b last:border-0 pb-2 last:pb-0">
              <p className="text-sm">
                <span className="font-medium">@{comment.username}</span>{" "}
                {comment.text}
              </p>
              {comment.postCaption && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  On: {comment.postCaption}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return null;
}
