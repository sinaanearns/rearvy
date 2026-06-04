"use client";

import { ExternalLink, Eye, Heart, Instagram, MessageCircle } from "lucide-react";

import {
  DataCardFrame,
  DataCardMessage,
  DataMetricTile,
} from "./data-card-frame";

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
      <DataCardMessage
        icon={Instagram}
        message={data.message}
        title="Instagram note"
        tone="rose"
      />
    );
  }

  if (data.username !== undefined || data.followers !== undefined) {
    return (
      <DataCardFrame
        icon={Instagram}
        title="Instagram account"
        subtitle={data.username ? `@${data.username}` : "Account performance"}
        tone="rose"
      >
        <div className="grid grid-cols-3 gap-3">
          <DataMetricTile
            label="Followers"
            value={formatNumber(data.followers ?? 0)}
            tone="rose"
          />
          <DataMetricTile
            label="Following"
            value={formatNumber(data.following ?? 0)}
            tone="rose"
          />
          <DataMetricTile
            label="Posts"
            value={formatNumber(data.mediaCount ?? 0)}
            tone="rose"
          />
        </div>
        {(data.periodImpressions || data.periodReach) && (
          <div className="grid grid-cols-3 gap-3 border-t border-border/70 pt-3 dark:border-white/10">
            <DataMetricTile
              label="Impressions"
              value={formatNumber(data.periodImpressions ?? 0)}
              tone="rose"
            />
            <DataMetricTile
              label="Reach"
              value={formatNumber(data.periodReach ?? 0)}
              tone="rose"
            />
            <DataMetricTile
              label="Profile views"
              value={formatNumber(data.periodProfileViews ?? 0)}
              tone="rose"
            />
          </div>
        )}
      </DataCardFrame>
    );
  }

  if (data.posts && data.posts.length > 0) {
    return (
      <DataCardFrame
        icon={Instagram}
        title="Instagram posts"
        subtitle="Recent content performance"
        tone="rose"
      >
        <div className="space-y-3">
          {data.posts.slice(0, 5).map((post, index) => (
            <div
              key={`${post.permalink || post.caption || "post"}:${index}`}
              className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                  {post.caption || "No caption"}
                </p>
                {post.permalink && (
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-[8px] p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Open Instagram post"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-[8px] border border-border/70 px-2 py-1 dark:border-white/10">
                  <Heart className="h-3 w-3" aria-hidden="true" />
                  {formatNumber(post.likes)} likes
                </span>
                <span className="inline-flex items-center gap-1 rounded-[8px] border border-border/70 px-2 py-1 dark:border-white/10">
                  <MessageCircle className="h-3 w-3" aria-hidden="true" />
                  {formatNumber(post.comments)} comments
                </span>
                {post.reach && (
                  <span className="inline-flex items-center gap-1 rounded-[8px] border border-border/70 px-2 py-1 dark:border-white/10">
                    <Eye className="h-3 w-3" aria-hidden="true" />
                    {formatNumber(post.reach)} reach
                  </span>
                )}
                {post.engagementRate !== undefined && (
                  <span className="rounded-[8px] border border-border/70 px-2 py-1 dark:border-white/10">
                    {post.engagementRate.toFixed(1)}% engagement
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </DataCardFrame>
    );
  }

  if (data.comments && data.comments.length > 0) {
    return (
      <DataCardFrame
        icon={Instagram}
        title="Instagram comments"
        subtitle="Recent community signals"
        tone="rose"
      >
        <div className="space-y-3">
          {data.comments.slice(0, 5).map((comment, index) => (
            <div
              key={`${comment.username}:${index}`}
              className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <p className="text-sm leading-6 text-foreground">
                <span className="font-semibold">@{comment.username}</span>{" "}
                {comment.text}
              </p>
              {comment.postCaption && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  On: {comment.postCaption}
                </p>
              )}
            </div>
          ))}
        </div>
      </DataCardFrame>
    );
  }

  return null;
}
