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
