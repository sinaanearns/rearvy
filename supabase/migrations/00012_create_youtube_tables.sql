-- ============================================
-- Migration: 00012_create_youtube_tables.sql
-- YouTube-specific tables for channel, video, comment, and analytics data
-- ============================================

-- YouTube Channels
CREATE TABLE youtube_channels (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id    UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  channel_id        TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  custom_url        TEXT,
  thumbnail_url     TEXT,
  country           TEXT,
  published_at      TIMESTAMPTZ,
  subscriber_count  BIGINT DEFAULT 0,
  video_count       INTEGER DEFAULT 0,
  view_count        BIGINT DEFAULT 0,
  synced_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

CREATE TRIGGER youtube_channels_updated_at
  BEFORE UPDATE ON youtube_channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_yt_channels_user ON youtube_channels(user_id);

ALTER TABLE youtube_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own YouTube channels"
  ON youtube_channels FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- YouTube Videos
CREATE TABLE youtube_videos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id    UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  channel_id        TEXT NOT NULL,
  video_id          TEXT NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  thumbnail_url     TEXT,
  published_at      TIMESTAMPTZ,
  duration          TEXT,
  tags              TEXT[] DEFAULT '{}',
  category_id       TEXT,
  privacy_status    TEXT CHECK (privacy_status IN ('public', 'private', 'unlisted')),
  view_count        BIGINT DEFAULT 0,
  like_count        BIGINT DEFAULT 0,
  comment_count     BIGINT DEFAULT 0,
  favorite_count    BIGINT DEFAULT 0,
  synced_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, video_id)
);

CREATE TRIGGER youtube_videos_updated_at
  BEFORE UPDATE ON youtube_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_yt_videos_user ON youtube_videos(user_id);
CREATE INDEX idx_yt_videos_channel ON youtube_videos(user_id, channel_id);
CREATE INDEX idx_yt_videos_published ON youtube_videos(user_id, published_at DESC);

ALTER TABLE youtube_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own YouTube videos"
  ON youtube_videos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- YouTube Comments
CREATE TABLE youtube_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id    UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  video_id          TEXT NOT NULL,
  comment_id        TEXT NOT NULL,
  parent_comment_id TEXT,
  author_name       TEXT,
  author_channel_id TEXT,
  author_image_url  TEXT,
  text_display      TEXT NOT NULL,
  like_count        INTEGER DEFAULT 0,
  reply_count       INTEGER DEFAULT 0,
  published_at      TIMESTAMPTZ,
  updated_at_yt     TIMESTAMPTZ,
  synced_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, comment_id)
);

CREATE INDEX idx_yt_comments_video ON youtube_comments(user_id, video_id);
CREATE INDEX idx_yt_comments_published ON youtube_comments(user_id, published_at DESC);

ALTER TABLE youtube_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own YouTube comments"
  ON youtube_comments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- YouTube Analytics (daily time-series)
CREATE TABLE youtube_analytics (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id              UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  channel_id                  TEXT NOT NULL,
  metric_date                 DATE NOT NULL,
  views                       BIGINT DEFAULT 0,
  estimated_minutes_watched   NUMERIC DEFAULT 0,
  subscribers_gained          INTEGER DEFAULT 0,
  subscribers_lost            INTEGER DEFAULT 0,
  likes                       INTEGER DEFAULT 0,
  dislikes                    INTEGER DEFAULT 0,
  comments                    INTEGER DEFAULT 0,
  shares                      INTEGER DEFAULT 0,
  average_view_duration       NUMERIC DEFAULT 0,
  impressions                 BIGINT DEFAULT 0,
  impressions_ctr             NUMERIC DEFAULT 0,
  synced_at                   TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, channel_id, metric_date)
);

CREATE INDEX idx_yt_analytics_user_date ON youtube_analytics(user_id, metric_date DESC);
CREATE INDEX idx_yt_analytics_channel_date ON youtube_analytics(user_id, channel_id, metric_date DESC);

ALTER TABLE youtube_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own YouTube analytics"
  ON youtube_analytics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
