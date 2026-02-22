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
