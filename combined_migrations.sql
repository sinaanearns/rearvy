-- Combined migrations for Supabase project zkaqgogpydbopbmvkyia
-- Generated on 2026-02-22T12:40:26.985Z
-- Run this in the Supabase Dashboard SQL Editor

-- ============================================
-- Migration: 00001_create_profiles.sql
-- ============================================

-- Create profiles table (extends auth.users)
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  avatar_url      TEXT,
  business_name   TEXT,
  business_type   TEXT CHECK (business_type IN ('shopify', 'content_creator', 'agency', 'other')),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  timezone        TEXT DEFAULT 'UTC',
  currency        TEXT DEFAULT 'USD',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- Migration: 00002_create_project_templates.sql
-- ============================================

-- Project templates (seeded, shared across all users)
CREATE TABLE project_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT CHECK (category IN ('launch', 'campaign', 'strategy', 'analysis', 'custom')),
  icon            TEXT,
  starter_prompts JSONB DEFAULT '[]',
  default_tools   TEXT[] DEFAULT '{}',
  system_prompt_addon TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Allow all authenticated users to read templates
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active templates"
  ON project_templates FOR SELECT
  USING (is_active = TRUE);

-- Seed default templates
INSERT INTO project_templates (slug, name, description, category, icon, starter_prompts, system_prompt_addon) VALUES
  ('product-launch', 'Product Launch', 'Plan and execute a new product launch with data-driven insights', 'launch', 'rocket',
   '[{"label": "Launch readiness check", "prompt": "Am I ready to launch? Check my inventory, pricing, and recent sales trends."},
     {"label": "Pricing strategy", "prompt": "Help me set the right price for my new product based on my current catalog and margins."},
     {"label": "Launch timeline", "prompt": "Create a launch timeline for my new product including marketing milestones."}]',
   'The user is planning a product launch. Focus on inventory readiness, pricing strategy, marketing timing, and competitive positioning.'),

  ('holiday-campaign', 'Holiday Campaign', 'Plan seasonal campaigns backed by your real sales data', 'campaign', 'gift',
   '[{"label": "Seasonal trends", "prompt": "Show me my sales patterns from past holiday seasons to plan this year."},
     {"label": "Discount strategy", "prompt": "What discount strategy should I use based on my margins and past campaign performance?"},
     {"label": "Inventory planning", "prompt": "Help me plan inventory for the holiday season based on historical demand."}]',
   'The user is planning a holiday/seasonal campaign. Focus on historical seasonal data, inventory planning, discount optimization, and campaign timing.'),

  ('content-strategy', 'Content Strategy', 'Build a content plan driven by engagement data', 'strategy', 'pen-tool',
   '[{"label": "Best performing content", "prompt": "What type of content gets me the most engagement? Analyze my recent posts."},
     {"label": "Posting schedule", "prompt": "When should I post for maximum engagement based on my audience data?"},
     {"label": "Content ideas", "prompt": "Give me content ideas based on my top products and audience interests."}]',
   'The user is developing a content strategy. Focus on engagement metrics, audience demographics, optimal posting times, and content-to-sales correlation.'),

  ('monthly-review', 'Monthly Review', 'Deep-dive into your business performance each month', 'analysis', 'bar-chart-3',
   '[{"label": "Monthly snapshot", "prompt": "Give me a complete business snapshot for this month vs last month."},
     {"label": "Top and bottom products", "prompt": "Which products are winning and which are underperforming this month?"},
     {"label": "Growth opportunities", "prompt": "Where are my biggest growth opportunities based on current trends?"}]',
   'The user is doing a monthly business review. Focus on month-over-month comparisons, trend analysis, product performance ranking, and actionable recommendations.');

-- ============================================
-- Migration: 00003_create_projects.sql
-- ============================================

-- Projects
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  template_id     UUID REFERENCES project_templates(id),
  settings        JSONB DEFAULT '{}',
  is_archived     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own projects"
  ON projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Migration: 00004_create_chats.sql
-- ============================================

-- Chats (with fork support)
CREATE TABLE chats (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id            UUID REFERENCES projects(id) ON DELETE SET NULL,
  title                 TEXT,
  parent_chat_id        UUID REFERENCES chats(id) ON DELETE SET NULL,
  fork_point_message_id UUID,
  is_archived           BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_chats_user ON chats(user_id, updated_at DESC);
CREATE INDEX idx_chats_project ON chats(project_id, updated_at DESC);

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own chats"
  ON chats FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Migration: 00005_create_messages.sql
-- ============================================

-- Messages (stores Vercel AI SDK parts + tool invocations)
CREATE TABLE messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id           UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content           TEXT,
  parts             JSONB,
  tool_invocations  JSONB,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_chat ON messages(chat_id, created_at ASC);

-- Update parent chat's updated_at on new message
CREATE OR REPLACE FUNCTION update_chat_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_inserted
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_on_message();

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access messages in own chats"
  ON messages FOR ALL
  USING (chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()))
  WITH CHECK (chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid()));

-- ============================================
-- Migration: 00006_create_integrations.sql
-- ============================================

-- Integrations (OAuth tokens for connected platforms)
CREATE TABLE integrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL CHECK (provider IN (
    'shopify', 'youtube', 'instagram', 'tiktok', 'stripe', 'google_analytics'
  )),
  provider_account_id   TEXT,
  provider_account_name TEXT,
  access_token_enc      TEXT NOT NULL,
  refresh_token_enc     TEXT,
  token_iv              TEXT NOT NULL,
  scopes                TEXT[] DEFAULT '{}',
  token_expires_at      TIMESTAMPTZ,
  status                TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_synced_at        TIMESTAMPTZ,
  sync_cursor           JSONB,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own integrations"
  ON integrations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Migration: 00007_create_business_metrics.sql
-- ============================================

-- Business metrics (normalized time-series data from all integrations)
CREATE TABLE business_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id  UUID REFERENCES integrations(id) ON DELETE SET NULL,
  metric_type     TEXT NOT NULL CHECK (metric_type IN (
    'revenue', 'orders', 'units_sold', 'refunds',
    'page_views', 'sessions', 'bounce_rate', 'conversion_rate',
    'followers', 'subscribers', 'likes', 'comments', 'shares', 'video_views',
    'impressions', 'reach', 'engagement_rate',
    'average_order_value', 'customer_count', 'repeat_customer_rate'
  )),
  metric_value    NUMERIC NOT NULL,
  dimensions      JSONB DEFAULT '{}',
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  granularity     TEXT DEFAULT 'daily' CHECK (granularity IN ('hourly', 'daily', 'weekly', 'monthly')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bm_user_type_period ON business_metrics(user_id, metric_type, period_start DESC);
CREATE INDEX idx_bm_dimensions ON business_metrics USING GIN(dimensions);

ALTER TABLE business_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own business metrics"
  ON business_metrics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Migration: 00008_create_products.sql
-- ============================================

-- Products (synced from Shopify and other e-commerce platforms)
CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id      UUID REFERENCES integrations(id) ON DELETE SET NULL,
  external_id         TEXT,
  title               TEXT NOT NULL,
  description         TEXT,
  price               NUMERIC,
  compare_at_price    NUMERIC,
  currency            TEXT DEFAULT 'USD',
  inventory_quantity  INTEGER,
  status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  product_type        TEXT,
  vendor              TEXT,
  tags                TEXT[] DEFAULT '{}',
  image_url           TEXT,
  handle              TEXT,
  variants_count      INTEGER DEFAULT 1,
  metadata            JSONB DEFAULT '{}',
  synced_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_user ON products(user_id);
CREATE INDEX idx_products_external ON products(user_id, external_id);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own products"
  ON products FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Migration: 00009_create_orders.sql
-- ============================================

-- Orders (synced from Shopify)
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id    UUID REFERENCES integrations(id) ON DELETE SET NULL,
  external_id       TEXT,
  order_number      TEXT,
  total_price       NUMERIC NOT NULL,
  subtotal_price    NUMERIC,
  total_tax         NUMERIC DEFAULT 0,
  total_discount    NUMERIC DEFAULT 0,
  shipping_cost     NUMERIC DEFAULT 0,
  currency          TEXT DEFAULT 'USD',
  financial_status  TEXT CHECK (financial_status IN ('pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'voided')),
  fulfillment_status TEXT CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled', 'restocked')),
  customer_email    TEXT,
  customer_name     TEXT,
  line_items        JSONB DEFAULT '[]',
  tags              TEXT[] DEFAULT '{}',
  placed_at         TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_user_placed ON orders(user_id, placed_at DESC);
CREATE INDEX idx_orders_external ON orders(user_id, external_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own orders"
  ON orders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Migration: 00010_create_memories.sql
-- ============================================

-- Memories (project-level AI context that persists across chats)
CREATE TABLE memories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id        UUID REFERENCES projects(id) ON DELETE SET NULL,
  content           TEXT NOT NULL,
  memory_type       TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'goal', 'decision', 'context', 'persona')),
  importance        INTEGER DEFAULT 5 CHECK (importance BETWEEN 1 AND 10),
  source_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  tags              TEXT[] DEFAULT '{}',
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_memories_user_active ON memories(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_memories_project ON memories(project_id, importance DESC) WHERE is_active = TRUE;

CREATE TRIGGER memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own memories"
  ON memories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Migration: 00011_create_insights.sql
-- ============================================

-- Insights (auto-detected business events and anomalies)
CREATE TABLE insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type    TEXT NOT NULL CHECK (insight_type IN ('anomaly', 'trend', 'milestone', 'opportunity', 'risk', 'sync_event')),
  severity        TEXT NOT NULL CHECK (severity IN ('info', 'notable', 'important', 'critical')),
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  data_snapshot   JSONB DEFAULT '{}',
  metric_refs     JSONB DEFAULT '[]',
  related_entity  JSONB,
  is_read         BOOLEAN DEFAULT FALSE,
  is_dismissed    BOOLEAN DEFAULT FALSE,
  generated_at    TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_insights_user_unread ON insights(user_id, generated_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_insights_user_all ON insights(user_id, generated_at DESC);

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own insights"
  ON insights FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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

