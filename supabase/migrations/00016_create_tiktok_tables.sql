-- TikTok integration tables

-- Account/profile data synced from TikTok API
CREATE TABLE tiktok_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  tiktok_id       TEXT NOT NULL,
  display_name    TEXT,
  avatar_url      TEXT,
  bio_description TEXT,
  follower_count  BIGINT NOT NULL DEFAULT 0,
  following_count BIGINT NOT NULL DEFAULT 0,
  likes_count     BIGINT NOT NULL DEFAULT 0,
  video_count     BIGINT NOT NULL DEFAULT 0,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, tiktok_id)
);

CREATE INDEX idx_tt_accounts_user ON tiktok_accounts(user_id);

-- Videos synced from TikTok
CREATE TABLE tiktok_videos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  video_id        TEXT NOT NULL,
  title           TEXT,
  description     TEXT,
  create_time     TIMESTAMPTZ,
  cover_image_url TEXT,
  share_url       TEXT,
  duration        INTEGER NOT NULL DEFAULT 0,  -- seconds
  view_count      BIGINT NOT NULL DEFAULT 0,
  like_count      BIGINT NOT NULL DEFAULT 0,
  comment_count   BIGINT NOT NULL DEFAULT 0,
  share_count     BIGINT NOT NULL DEFAULT 0,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, video_id)
);

CREATE INDEX idx_tt_videos_user ON tiktok_videos(user_id);
CREATE INDEX idx_tt_videos_created ON tiktok_videos(user_id, create_time DESC);

-- RLS Policies
ALTER TABLE tiktok_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiktok_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tiktok_accounts"
  ON tiktok_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on tiktok_accounts"
  ON tiktok_accounts FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage own tiktok_videos"
  ON tiktok_videos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on tiktok_videos"
  ON tiktok_videos FOR ALL USING (auth.role() = 'service_role');
