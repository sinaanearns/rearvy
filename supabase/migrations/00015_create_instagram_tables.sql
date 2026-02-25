-- Instagram integration tables

-- Account/profile data synced from Instagram Graph API
CREATE TABLE instagram_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  instagram_id    TEXT NOT NULL,
  username        TEXT NOT NULL,
  name            TEXT,
  profile_picture_url TEXT,
  biography       TEXT,
  website         TEXT,
  followers_count BIGINT NOT NULL DEFAULT 0,
  follows_count   BIGINT NOT NULL DEFAULT 0,
  media_count     BIGINT NOT NULL DEFAULT 0,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, instagram_id)
);

CREATE INDEX idx_ig_accounts_user ON instagram_accounts(user_id);

-- Posts / Reels / Carousel albums
CREATE TABLE instagram_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  post_id         TEXT NOT NULL,
  caption         TEXT,
  media_type      TEXT NOT NULL DEFAULT 'IMAGE',  -- IMAGE, VIDEO, CAROUSEL_ALBUM
  media_url       TEXT,
  thumbnail_url   TEXT,
  permalink       TEXT,
  published_at    TIMESTAMPTZ,
  like_count      BIGINT NOT NULL DEFAULT 0,
  comments_count  BIGINT NOT NULL DEFAULT 0,
  reach           BIGINT,
  impressions     BIGINT,
  engagement      BIGINT,
  saved           BIGINT,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_ig_posts_user ON instagram_posts(user_id);
CREATE INDEX idx_ig_posts_published ON instagram_posts(user_id, published_at DESC);

-- Comments on posts
CREATE TABLE instagram_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  post_id         TEXT NOT NULL,
  comment_id      TEXT NOT NULL,
  text            TEXT NOT NULL,
  username        TEXT,
  published_at    TIMESTAMPTZ,
  like_count      BIGINT NOT NULL DEFAULT 0,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, comment_id)
);

CREATE INDEX idx_ig_comments_post ON instagram_comments(user_id, post_id);
CREATE INDEX idx_ig_comments_published ON instagram_comments(user_id, published_at DESC);

-- Account-level daily analytics
CREATE TABLE instagram_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  metric_date     DATE NOT NULL,
  follower_count  BIGINT,
  impressions     BIGINT,
  reach           BIGINT,
  profile_views   BIGINT,
  synced_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, integration_id, metric_date)
);

CREATE INDEX idx_ig_analytics_date ON instagram_analytics(user_id, metric_date DESC);

-- RLS Policies
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own instagram_accounts"
  ON instagram_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on instagram_accounts"
  ON instagram_accounts FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage own instagram_posts"
  ON instagram_posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on instagram_posts"
  ON instagram_posts FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage own instagram_comments"
  ON instagram_comments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on instagram_comments"
  ON instagram_comments FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can manage own instagram_analytics"
  ON instagram_analytics FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on instagram_analytics"
  ON instagram_analytics FOR ALL USING (auth.role() = 'service_role');
