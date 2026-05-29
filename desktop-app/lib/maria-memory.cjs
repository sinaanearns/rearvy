const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

let electronApp = null;
try {
  electronApp = require("electron").app;
} catch {
  electronApp = null;
}

const MEMORY_FILE_NAME = "maria-memory.json";
const MAX_MEMORIES = 80;
const MAX_PROMPT_MEMORIES = 12;
const MAX_CONTENT_LENGTH = 240;
const MAX_VALUE_LENGTH = 80;

const SENSITIVE_MEMORY_PATTERN =
  /\b(password|passcode|api key|secret|token|private key|seed phrase|recovery phrase|credit card|card number|cvv|ssn|social security)\b/i;

function collapseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeForKey(value) {
  return collapseWhitespace(value).toLowerCase();
}

function hashText(value) {
  return crypto.createHash("sha256").update(normalizeForKey(value)).digest("hex").slice(0, 16);
}

function trimTrailingPunctuation(value) {
  return collapseWhitespace(value).replace(/^[`'"]+|[`'".,!?;:]+$/g, "").trim();
}

function cleanValue(value, maxLength = MAX_VALUE_LENGTH) {
  const cleaned = trimTrailingPunctuation(value)
    .replace(/\s+(?:please|pls|ok|okay)$/i, "")
    .trim();
  return cleaned.slice(0, maxLength).trim();
}

function cleanName(value) {
  return cleanValue(
    String(value || "").split(/\b(?:and|but|so|then|also|can you|could you|what can|what do|please)\b/i)[0],
    MAX_VALUE_LENGTH
  );
}

function buildMemory({
  key,
  label,
  kind = "context",
  content,
  value = "",
  importance = 7,
  tags = [],
}) {
  const cleanContent = collapseWhitespace(content).slice(0, MAX_CONTENT_LENGTH).trim();
  if (!cleanContent) {
    return null;
  }

  return {
    key: key || `memory.${hashText(cleanContent)}`,
    label,
    kind,
    content: cleanContent,
    value: cleanValue(value, MAX_CONTENT_LENGTH),
    importance,
    tags,
  };
}

function matchFirst(text, patterns) {
  for (const item of patterns) {
    const match = text.match(item.pattern);
    if (match?.[1]) {
      const value = item.cleaner ? item.cleaner(match[1]) : cleanValue(match[1]);
      if (value) {
        return item.toMemory(value);
      }
    }
  }

  return null;
}

function extractMemorySaveIntent(command) {
  const text = collapseWhitespace(command);
  if (!text) {
    return null;
  }

  if (SENSITIVE_MEMORY_PATTERN.test(text)) {
    return {
      blocked: true,
      reason: "sensitive-memory",
      message: "I will not store passwords, keys, tokens, payment details, or recovery phrases in Maria memory.",
    };
  }

  const directMemory = matchFirst(text, [
    {
      pattern: /\b(?:your name is|from now on,?\s+your name is|from now on,?\s+i(?:'ll| will) call you|i(?:'ll| will) call you)\s+(.+)$/i,
      cleaner: cleanName,
      toMemory: (value) =>
        buildMemory({
          key: "assistant.name",
          label: "Assistant name",
          kind: "identity",
          value,
          content: `Maria's preferred assistant name is ${value}.`,
          importance: 9,
          tags: ["identity", "assistant-name"],
        }),
    },
    {
      pattern: /\b(?:my name is|i am called|i'm called|you can call me|call me)\s+(.+)$/i,
      cleaner: cleanName,
      toMemory: (value) =>
        buildMemory({
          key: "user.name",
          label: "User name",
          kind: "identity",
          value,
          content: `The user's name is ${value}.`,
          importance: 9,
          tags: ["identity", "user-name"],
        }),
    },
    {
      pattern: /\b(?:my business is|our business is|my company is|our company is|business name is|company name is)\s+(.+)$/i,
      toMemory: (value) =>
        buildMemory({
          key: "business.name",
          label: "Business name",
          kind: "business",
          value,
          content: `The user's business is ${value}.`,
          importance: 8,
          tags: ["business"],
        }),
    },
    {
      pattern: /\b(?:i prefer|i like it when|please prefer)\s+(.+)$/i,
      toMemory: (value) =>
        buildMemory({
          key: `preference.${hashText(value)}`,
          label: "Preference",
          kind: "preference",
          value,
          content: `The user prefers ${value}.`,
          importance: 7,
          tags: ["preference"],
        }),
    },
    {
      pattern: /\b(?:my goal is|our goal is|i want to|we want to)\s+(.+)$/i,
      toMemory: (value) =>
        buildMemory({
          key: `goal.${hashText(value)}`,
          label: "Goal",
          kind: "goal",
          value,
          content: `The user's goal is ${value}.`,
          importance: 7,
          tags: ["goal"],
        }),
    },
    {
      pattern: /\b(?:i am building|i'm building|we are building|we're building)\s+(.+)$/i,
      toMemory: (value) =>
        buildMemory({
          key: `project.${hashText(value)}`,
          label: "Project",
          kind: "project",
          value,
          content: `The user is building ${value}.`,
          importance: 7,
          tags: ["project"],
        }),
    },
    {
      pattern: /\b(?:i am|i'm)\s+((?:(?:a|an|the)\s+)?(?:developer|founder|owner|creator|ceo|boss|student|designer|marketer|trader|manager|engineer)\b.*)$/i,
      toMemory: (_value) =>
        buildMemory({
          key: "user.role",
          label: "User role",
          kind: "identity",
          value: text,
          content: text.endsWith(".") ? text : `${text}.`,
          importance: 7,
          tags: ["identity", "role"],
        }),
    },
  ]);

  if (directMemory) {
    return { memory: directMemory };
  }

  const explicitMatch = text.match(/\b(?:remember that|remember|don't forget that|don't forget|important:?|save this(?: in memory)?:?)\s+(.+)$/i);
  if (explicitMatch?.[1]) {
    const content = cleanValue(explicitMatch[1], MAX_CONTENT_LENGTH);
    const memory = buildMemory({
      key: `memory.${hashText(content)}`,
      label: "Saved memory",
      kind: "context",
      value: content,
      content: content.endsWith(".") ? content : `${content}.`,
      importance: 8,
      tags: ["explicit-memory"],
    });

    if (memory) {
      return { memory };
    }
  }

  return null;
}

function detectMemoryQuery(command) {
  const text = normalizeForKey(command);
  if (!text) {
    return null;
  }

  if (/\b(what'?s|what is|do you know|tell me)\s+my name\b/.test(text) || /\bwho am i\b/.test(text)) {
    return { type: "single", key: "user.name", fallback: "I do not have your name saved yet." };
  }

  if (/\b(what'?s|what is|do you know|tell me)\s+your name\b/.test(text) || /\bwhat should i call you\b/.test(text)) {
    return { type: "single", key: "assistant.name", fallback: "I am Maria. You can give me another name if you want me to remember it." };
  }

  if (/\b(what do you remember|what is in memory|show memory|show memories|list memories|tell me what you remember)\b/.test(text)) {
    return { type: "list" };
  }

  return null;
}

class MariaMemoryStore {
  constructor(options = {}) {
    this.filePath = options.filePath || this.resolveFilePath();
  }

  resolveFilePath() {
    if (process.env.REARVY_MARIA_MEMORY_PATH) {
      return process.env.REARVY_MARIA_MEMORY_PATH;
    }

    if (electronApp?.getPath) {
      return path.join(electronApp.getPath("userData"), MEMORY_FILE_NAME);
    }

    return path.join(process.cwd(), ".rearvy", MEMORY_FILE_NAME);
  }

  extractSaveIntent(command) {
    return extractMemorySaveIntent(command);
  }

  async readState() {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      const memories = Array.isArray(parsed?.memories) ? parsed.memories : [];
      return {
        version: 1,
        memories: memories.filter((memory) => memory && typeof memory.content === "string"),
      };
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn("[MariaMemory] Failed to read memory file:", error?.message || error);
      }
      return { version: 1, memories: [] };
    }
  }

  async writeState(state) {
    const directory = path.dirname(this.filePath);
    await fs.mkdir(directory, { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await fs.rename(tmpPath, this.filePath);
  }

  sortMemories(memories) {
    return [...memories].sort((left, right) => {
      const importanceDelta = Number(right.importance || 0) - Number(left.importance || 0);
      if (importanceDelta !== 0) {
        return importanceDelta;
      }

      return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
    });
  }

  async saveMemory(memoryInput) {
    const memory = buildMemory(memoryInput);
    if (!memory) {
      throw new Error("Memory content is required.");
    }

    const state = await this.readState();
    const now = new Date().toISOString();
    const existingIndex = state.memories.findIndex((item) => item.key === memory.key);
    let created = false;
    let stored = null;

    if (existingIndex >= 0) {
      stored = {
        ...state.memories[existingIndex],
        ...memory,
        importance: Math.max(Number(state.memories[existingIndex].importance || 0), Number(memory.importance || 0)),
        createdAt: state.memories[existingIndex].createdAt || now,
        updatedAt: now,
      };
      state.memories[existingIndex] = stored;
    } else {
      created = true;
      stored = {
        id: crypto.randomUUID(),
        ...memory,
        createdAt: now,
        updatedAt: now,
      };
      state.memories.push(stored);
    }

    state.memories = this.sortMemories(state.memories).slice(0, MAX_MEMORIES);
    await this.writeState(state);

    return { created, memory: stored };
  }

  async getMemories(limit = MAX_PROMPT_MEMORIES) {
    const state = await this.readState();
    return this.sortMemories(state.memories).slice(0, limit);
  }

  async getPromptMemories(limit = MAX_PROMPT_MEMORIES) {
    const memories = await this.getMemories(limit);
    return memories.map((memory) => ({
      key: memory.key,
      label: memory.label,
      kind: memory.kind,
      content: collapseWhitespace(memory.content).slice(0, MAX_CONTENT_LENGTH),
      importance: Number(memory.importance || 0),
      updatedAt: memory.updatedAt,
    }));
  }

  async answerMemoryQuery(command) {
    const query = detectMemoryQuery(command);
    if (!query) {
      return null;
    }

    const memories = await this.getMemories(MAX_PROMPT_MEMORIES);

    if (query.type === "single") {
      const memory = memories.find((item) => item.key === query.key);
      if (!memory) {
        return { found: false, reply: query.fallback };
      }

      if (query.key === "user.name" && memory.value) {
        return { found: true, reply: `Your name is ${memory.value}.`, memories: [memory] };
      }

      if (query.key === "assistant.name" && memory.value) {
        return { found: true, reply: `You told me to use the name ${memory.value}.`, memories: [memory] };
      }

      return { found: true, reply: memory.content, memories: [memory] };
    }

    if (query.type === "list") {
      if (memories.length === 0) {
        return { found: false, reply: "I do not have any Maria memories saved yet." };
      }

      const summary = memories
        .slice(0, 5)
        .map((memory) => memory.content.replace(/[.]+$/g, ""))
        .join("; ");

      return { found: true, reply: `I remember: ${summary}.`, memories };
    }

    return null;
  }
}

module.exports = {
  MariaMemoryStore,
  extractMemorySaveIntent,
  detectMemoryQuery,
};
