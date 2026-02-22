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
