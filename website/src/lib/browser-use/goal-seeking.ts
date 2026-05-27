export type BrowserTaskStrategy = "goal-seeking" | "open-only";

export type BrowserGoal = "signup" | "login" | "generic";

export type PageScanCandidate = {
  kind: "link" | "button" | "input" | "form";
  text: string;
  href?: string | null;
  selector?: string | null;
  visible?: boolean;
};

export type PageScanResult = {
  title?: string | null;
  url?: string | null;
  text?: string | null;
  links?: PageScanCandidate[];
  buttons?: PageScanCandidate[];
  forms?: PageScanCandidate[];
};

export type RankedGoalCandidate = PageScanCandidate & {
  score: number;
  reason: string;
};

const SIGNUP_TASK_PATTERN =
  /\b(sign\s*up|signup|register|create\s+(?:an?\s+|my\s+|your\s+)?account|create\s+(?:a\s+)?store|start\s+(?:a\s+)?free\s+trial|get\s+started)\b/i;
const LOGIN_TASK_PATTERN =
  /\b(?:log\s*in|sign\s*in|login|signin|log\s*into|sign\s*into)\b/i;

const SIGNUP_TERMS = [
  "sign up",
  "signup",
  "start free trial",
  "free trial",
  "get started",
  "create account",
  "create your account",
  "create store",
  "start selling",
  "register",
  "join now",
];

const LOGIN_TERMS = [
  "log in",
  "login",
  "sign in",
  "signin",
  "continue",
  "account login",
  "admin login",
];

const GENERIC_TERMS = [
  "learn more",
  "continue",
  "open",
  "view",
  "next",
];

function normalizeText(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function goalTerms(goal: BrowserGoal) {
  if (goal === "signup") {
    return SIGNUP_TERMS;
  }

  if (goal === "login") {
    return LOGIN_TERMS;
  }

  return GENERIC_TERMS;
}

export function detectBrowserGoal(task: string): BrowserGoal {
  if (SIGNUP_TASK_PATTERN.test(task)) {
    return "signup";
  }

  if (LOGIN_TASK_PATTERN.test(task)) {
    return "login";
  }

  return "generic";
}

function candidateText(candidate: PageScanCandidate) {
  return normalizeText([candidate.text, candidate.href].filter(Boolean).join(" "));
}

function scoreCandidate(candidate: PageScanCandidate, goal: BrowserGoal) {
  const text = candidateText(candidate);
  let score = 0;
  const reasons: string[] = [];

  for (const term of goalTerms(goal)) {
    if (text.includes(term)) {
      score += goal === "generic" ? 8 : 25;
      reasons.push(term);
    }
  }

  if (candidate.visible) {
    score += 6;
  }

  if (candidate.kind === "link" && candidate.href) {
    score += 5;
  }

  if (candidate.kind === "button") {
    score += 4;
  }

  if (/\b(sign|signup|register|login|trial|start|account|admin)\b/i.test(candidate.href || "")) {
    score += 10;
  }

  if (/\b(policy|terms|privacy|blog|careers|help|support|contact)\b/i.test(text)) {
    score -= 20;
  }

  return {
    score,
    reason: reasons.length > 0 ? reasons.join(", ") : "ranked candidate",
  };
}

export function rankGoalCandidates(
  scan: PageScanResult,
  task: string
): RankedGoalCandidate[] {
  const goal = detectBrowserGoal(task);
  const candidates = [
    ...(scan.links || []),
    ...(scan.buttons || []),
    ...(scan.forms || []),
  ];

  return candidates
    .map((candidate) => ({
      ...candidate,
      ...scoreCandidate(candidate, goal),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
}

export function isGoalLikelySatisfied(scan: PageScanResult, task: string) {
  const goal = detectBrowserGoal(task);
  const text = normalizeText([scan.title, scan.url, scan.text].filter(Boolean).join(" "));

  if (goal === "signup") {
    return SIGNUP_TERMS.some((term) => text.includes(term)) && /\b(email|account|store|trial)\b/.test(text);
  }

  if (goal === "login") {
    return LOGIN_TERMS.some((term) => text.includes(term)) && /\b(email|password|account|admin)\b/.test(text);
  }

  return Boolean(text);
}

export function buildGoalSeekingNotFoundSummary(attempts: string[]) {
  const uniqueAttempts = Array.from(new Set(attempts.filter(Boolean))).slice(0, 8);
  return uniqueAttempts.length > 0
    ? `Could not find the requested browser target after trying ${uniqueAttempts.join(", ")}.`
    : "Could not find the requested browser target with the available browser controls.";
}
