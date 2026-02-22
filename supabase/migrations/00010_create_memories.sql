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
