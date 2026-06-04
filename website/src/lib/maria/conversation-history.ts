export type MariaConversationTurn = {
  user: string;
  assistant: string;
};

const MAX_HISTORY_TURN_LENGTH = 700;
const MAX_HISTORY_TURN_COUNT = 8;

function coerceHistoryText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, MAX_HISTORY_TURN_LENGTH);
}

export function coerceMariaConversationHistory(value: unknown): MariaConversationTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-MAX_HISTORY_TURN_COUNT)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const user = coerceHistoryText(record.user ?? record.userTranscript ?? record.command ?? record.message);
      const assistant = coerceHistoryText(record.assistant ?? record.assistantResponse ?? record.reply ?? record.response);

      if (!user || !assistant) {
        return null;
      }

      return { user, assistant };
    })
    .filter((turn): turn is MariaConversationTurn => Boolean(turn));
}

export function formatMariaConversationHistory(history: MariaConversationTurn[]) {
  if (history.length === 0) {
    return "No recent Maria conversation in this desktop session.";
  }

  return history
    .map((turn, index) => `${index + 1}. User: ${turn.user}\n   Maria: ${turn.assistant}`)
    .join("\n");
}
