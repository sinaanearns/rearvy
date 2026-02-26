-- ============================================
-- Migration: 00018_create_website_tracking_tables.sql
-- Website tracking tables for pageviews, sessions, and events
-- ============================================

-- Websites (registered tracking domains)
CREATE TABLE websites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id       TEXT NOT NULL UNIQUE,
  domain        TEXT NOT NULL,
  name          TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, domain)
);

CREATE TRIGGER websites_updated_at
  BEFORE UPDATE ON websites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_websites_user ON websites(user_id);
CREATE INDEX idx_websites_site_id ON websites(site_id);

ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own websites"
  ON websites FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Website Sessions
CREATE TABLE website_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visitor_id    TEXT NOT NULL,
  session_id    TEXT NOT NULL UNIQUE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  duration_ms   INTEGER DEFAULT 0,
  page_count    INTEGER DEFAULT 0,
  entry_page    TEXT,
  exit_page     TEXT,
  referrer      TEXT,
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,
  utm_term      TEXT,
  utm_content   TEXT,
  country       TEXT,
  device_type   TEXT,
  browser       TEXT,
  os            TEXT,
  screen_width  INTEGER,
  screen_height INTEGER,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ws_sessions_website ON website_sessions(website_id);
CREATE INDEX idx_ws_sessions_user ON website_sessions(user_id);
CREATE INDEX idx_ws_sessions_visitor ON website_sessions(website_id, visitor_id);
CREATE INDEX idx_ws_sessions_started ON website_sessions(user_id, started_at DESC);

ALTER TABLE website_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own website sessions"
  ON website_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Website Pageviews
CREATE TABLE website_pageviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL,
  visitor_id    TEXT NOT NULL,
  url           TEXT NOT NULL,
  path          TEXT NOT NULL,
  title         TEXT,
  referrer      TEXT,
  duration_ms   INTEGER DEFAULT 0,
  scroll_depth  INTEGER DEFAULT 0,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ws_pageviews_website ON website_pageviews(website_id);
CREATE INDEX idx_ws_pageviews_user ON website_pageviews(user_id);
CREATE INDEX idx_ws_pageviews_path ON website_pageviews(website_id, path);
CREATE INDEX idx_ws_pageviews_timestamp ON website_pageviews(user_id, timestamp DESC);

ALTER TABLE website_pageviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own website pageviews"
  ON website_pageviews FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Website Events (clicks + scroll + custom events)
CREATE TABLE website_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id    TEXT NOT NULL,
  visitor_id    TEXT NOT NULL,
  event_type    TEXT NOT NULL CHECK (event_type IN ('click', 'scroll', 'custom')),
  event_name    TEXT,
  properties    JSONB DEFAULT '{}',
  url           TEXT,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ws_events_website ON website_events(website_id);
CREATE INDEX idx_ws_events_user ON website_events(user_id);
CREATE INDEX idx_ws_events_type ON website_events(website_id, event_type);
CREATE INDEX idx_ws_events_timestamp ON website_events(user_id, timestamp DESC);
CREATE INDEX idx_ws_events_name ON website_events(website_id, event_name)
  WHERE event_name IS NOT NULL;

ALTER TABLE website_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own website events"
  ON website_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
