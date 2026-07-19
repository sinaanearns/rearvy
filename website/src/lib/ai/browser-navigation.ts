import { detectTradingPairIntent } from "./trading-intent";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type QuickOpenTarget = {
  label: string;
  url: string;
  loginUrl?: string;
  aliases: string[];
  hosts: string[];
};

const QUICK_OPEN_TARGETS: QuickOpenTarget[] = [
  {
    label: "Gmail",
    url: "https://mail.google.com",
    aliases: ["gmail", "google mail"],
    hosts: ["mail.google.com"],
  },
  {
    label: "Google Drive",
    url: "https://drive.google.com",
    aliases: ["google drive", "drive"],
    hosts: ["drive.google.com"],
  },
  {
    label: "Google Docs",
    url: "https://docs.google.com/document",
    aliases: ["google docs", "docs"],
    hosts: ["docs.google.com"],
  },
  {
    label: "Google Sheets",
    url: "https://docs.google.com/spreadsheets",
    aliases: ["google sheets", "sheets"],
    hosts: ["docs.google.com"],
  },
  {
    label: "Google Slides",
    url: "https://docs.google.com/presentation",
    aliases: ["google slides", "slides"],
    hosts: ["docs.google.com"],
  },
  {
    label: "Google",
    url: "https://www.google.com",
    aliases: ["google"],
    hosts: ["google.com", "www.google.com"],
  },
  {
    label: "YouTube",
    url: "https://www.youtube.com",
    aliases: ["youtube"],
    hosts: ["youtube.com", "www.youtube.com"],
  },
  {
    label: "Instagram",
    url: "https://www.instagram.com",
    aliases: ["instagram"],
    hosts: ["instagram.com", "www.instagram.com"],
  },
  {
    label: "Facebook",
    url: "https://www.facebook.com",
    aliases: ["facebook"],
    hosts: ["facebook.com", "www.facebook.com"],
  },
  {
    label: "LinkedIn",
    url: "https://www.linkedin.com",
    aliases: ["linkedin"],
    hosts: ["linkedin.com", "www.linkedin.com"],
  },
  {
    label: "X",
    url: "https://x.com",
    aliases: ["twitter", "x"],
    hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  },
  {
    label: "TikTok",
    url: "https://www.tiktok.com",
    aliases: ["tiktok"],
    hosts: ["tiktok.com", "www.tiktok.com"],
  },
  {
    label: "Reddit",
    url: "https://www.reddit.com",
    aliases: ["reddit"],
    hosts: ["reddit.com", "www.reddit.com"],
  },
  {
    label: "GitHub",
    url: "https://github.com",
    aliases: ["github"],
    hosts: ["github.com", "www.github.com"],
  },
  {
    label: "GitLab",
    url: "https://gitlab.com",
    aliases: ["gitlab"],
    hosts: ["gitlab.com", "www.gitlab.com"],
  },
  {
    label: "Notion",
    url: "https://www.notion.so",
    aliases: ["notion"],
    hosts: ["notion.so", "www.notion.so"],
  },
  {
    label: "Figma",
    url: "https://www.figma.com",
    aliases: ["figma"],
    hosts: ["figma.com", "www.figma.com"],
  },
  {
    label: "Shopify",
    url: "https://www.shopify.com",
    loginUrl: "https://www.shopify.com/login",
    aliases: ["shopify"],
    hosts: ["shopify.com", "www.shopify.com"],
  },
  {
    label: "Amazon",
    url: "https://www.amazon.com",
    aliases: ["amazon"],
    hosts: ["amazon.com", "www.amazon.com"],
  },
  {
    label: "Netflix",
    url: "https://www.netflix.com",
    aliases: ["netflix"],
    hosts: ["netflix.com", "www.netflix.com"],
  },
  {
    label: "Rearvy",
    url: "https://www.rearvy.com",
    aliases: ["rearvy"],
    hosts: ["rearvy.com", "www.rearvy.com"],
  },
];

const DIRECT_BROWSER_COMMAND_PATTERN =
  /^(open|go to|goto|visit|navigate to|browse to|load|launch)\b/i;
const SIGNUP_INTENT_PATTERN =
  /\b(sign\s*up|signup|register|create\s+(?:an?\s+|my\s+|your\s+)?account|make\s+(?:an?\s+|my\s+|your\s+)?account)\b/i;
const EMAIL_ADDRESS_PATTERN =
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const LOGIN_INTENT_PATTERNS = [
  /\b(?:log\s*in|sign\s*in|log\s*into|sign\s*into)\b/i,
  /\b(?:login|signin)\s+(?:to|into|with|at|on|for)\b/i,
  /\b(?:log|sign)\s+me\s+in\b/i,
  /\b(?:login|signin)\s+for\s+me\b/i,
];
const EXPLICIT_BROWSER_WORKFLOW_PATTERN =
  /\b(in the browser|browser task|browser workflow|open the site|open the website|visit the website)\b/i;
const OPERATOR_BROWSER_WORKFLOW_PATTERN =
  /\b(?:clicky|competitor|competitors?|research\s+competitors?|go(?:es)?\s+on|find(?:s)?\s+screenshots?|take\s+screenshots?|capture\s+screenshots?|make\s+(?:a\s+)?product\s+like|copy\s+the\s+flow|inspect\s+(?:their|the)\s+(?:site|website|page|product|dashboard)|use\s+(?:the\s+)?website|work\s+on\s+(?:the\s+)?website|open\s+(?:a\s+)?website)\b/i;
const PRODUCT_BUILD_FROM_RESEARCH_PATTERN =
  /\b(?:make|build|create|design|ship|clone|recreate)\s+(?:a\s+|an\s+|the\s+)?(?:product|app|website|page|landing\s+page|dashboard|flow|feature|tool)\s+(?:like|similar\s+to|inspired\s+by|from|based\s+on)\b|\b(?:turn|convert)\s+(?:this|that|their|the)\s+(?:research|competitor|page|website|flow|screenshots?)\s+into\s+(?:a\s+|an\s+)?(?:product|app|website|feature|spec|prd|implementation)\b/i;
const OPERATOR_DESKTOP_CONTEXT_PATTERN =
  /\b(?:open\s+(?:an?\s+)?app|work\s+on\s+(?:that\s+)?app|desktop\s+app|local\s+app|application)\b/i;
const DOMAIN_LIKE_PATTERN =
  /\b((?:https?:\/\/)?(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)\b/i;
const FILE_PATH_PATTERN =
  /^(?:[a-z]:[\\/]|\/|\.{1,2}[\\/])/i;
const FILE_EXTENSION_PATTERN =
  /\.(?:txt|pdf|doc|docx|xls|xlsx|csv|json|png|jpe?g|gif|webp|svg|mp4|mov|avi|zip|md|log)(?:$|[?#\s])/i;
const NON_WEB_TARGET_PATTERN =
  /^(?:(?:the|my|our|this|that|these|those)\s+)?(?:settings?|file|files|folder|folders|directory|directories|terminal|powershell|cmd|command prompt|notepad|calculator|camera|microphone|speaker|downloads?|documents?|photos?|videos?|image|images|pdf|report|reports|logs?)\b/i;
const FALLBACK_SITE_LIKE_PATTERN =
  /^[a-z0-9][a-z0-9 .&+/_-]*$/i;
const REPEAT_ONLY_DESTINATION_PATTERN =
  /^(?:again|it\s+again|that\s+again|this\s+again|the\s+same\s+again|same\s+again|same\s+app\s+again|same\s+one\s+again)$/i;
const CLICKY_RESEARCH_SEARCH_PATTERN =
  /\b(?:competitors?|research|screenshots?|product\s+like|similar\s+to|inspired\s+by|pricing|onboarding|dashboard|ui\s+patterns?)\b/i;
const COMPETITOR_OF_PATTERN =
  /\bcompetitors?\s+(?:of|for|to|like|similar\s+to)\b/i;

function normalizeAliasText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildAliasCandidates(value: string) {
  const normalizedTokens = (value.toLowerCase().match(/[a-z0-9]+/g) ?? [])
    .map(normalizeAliasText)
    .filter(Boolean);
  const candidates = new Set<string>();

  for (let start = 0; start < normalizedTokens.length; start += 1) {
    let combined = "";
    for (
      let end = start;
      end < Math.min(normalizedTokens.length, start + 3);
      end += 1
    ) {
      combined += normalizedTokens[end];
      if (combined.length >= 4 && combined.length <= 24) {
        candidates.add(combined);
      }
    }
  }

  const compact = normalizeAliasText(value);
  if (compact.length >= 4 && compact.length <= 24) {
    candidates.add(compact);
  }

  return Array.from(candidates);
}

function boundedEditDistance(left: string, right: string, maxDistance: number) {
  if (Math.abs(left.length - right.length) > maxDistance) {
    return maxDistance + 1;
  }

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    let rowBest = current[0];

    for (let j = 1; j <= right.length; j += 1) {
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      const nextValue = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost
      );
      current[j] = nextValue;
      rowBest = Math.min(rowBest, nextValue);
    }

    if (rowBest > maxDistance) {
      return maxDistance + 1;
    }

    previous = current;
  }

  return previous[right.length];
}

function maxAliasTypoDistance(alias: string, candidate: string) {
  if (alias.length < 4 || candidate.length < 4) {
    return 0;
  }

  if (Math.abs(alias.length - candidate.length) > 2) {
    return 0;
  }

  return Math.max(alias.length, candidate.length) >= 6 ? 2 : 1;
}

function findFuzzyQuickOpenTarget(value: string) {
  const candidates = buildAliasCandidates(value);
  let best:
    | {
        target: QuickOpenTarget;
        distance: number;
        aliasLength: number;
      }
    | null = null;
  let ambiguous = false;

  for (const target of QUICK_OPEN_TARGETS) {
    for (const alias of target.aliases) {
      const normalizedAlias = normalizeAliasText(alias);
      for (const candidate of candidates) {
        const maxDistance = maxAliasTypoDistance(normalizedAlias, candidate);
        if (maxDistance === 0) {
          continue;
        }

        const distance = boundedEditDistance(
          normalizedAlias,
          candidate,
          maxDistance
        );
        if (distance > maxDistance) {
          continue;
        }

        const next = {
          target,
          distance,
          aliasLength: normalizedAlias.length,
        };

        if (
          !best ||
          next.distance < best.distance ||
          (next.distance === best.distance &&
            next.aliasLength > best.aliasLength)
        ) {
          best = next;
          ambiguous = false;
          continue;
        }

        if (
          next.distance === best.distance &&
          next.aliasLength === best.aliasLength &&
          next.target !== best.target
        ) {
          ambiguous = true;
        }
      }
    }
  }

  return ambiguous ? null : best?.target ?? null;
}

function findQuickOpenTarget(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return null;
  }

  for (const target of QUICK_OPEN_TARGETS) {
    if (
      target.aliases.some((alias) =>
        new RegExp(`(^|\\b)${escapeRegExp(alias)}(\\b|$)`, "i").test(
          normalizedValue
        )
      )
    ) {
      return target;
    }
  }

  return findFuzzyQuickOpenTarget(normalizedValue);
}

function findQuickOpenTargetByUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return (
      QUICK_OPEN_TARGETS.find((target) =>
        target.hosts.some(
          (host) => hostname === host || hostname.endsWith(`.${host}`)
        )
      ) ?? null
    );
  } catch {
    return null;
  }
}

export function hasBrowserAuthIntent(userText: string | null | undefined) {
  if (!userText) {
    return false;
  }

  return (
    SIGNUP_INTENT_PATTERN.test(userText) ||
    LOGIN_INTENT_PATTERNS.some((pattern) => pattern.test(userText))
  );
}

export function hasBrowserSignupIntent(userText: string | null | undefined) {
  return Boolean(userText && SIGNUP_INTENT_PATTERN.test(userText));
}

export function hasBrowserLoginIntent(userText: string | null | undefined) {
  return Boolean(
    userText && LOGIN_INTENT_PATTERNS.some((pattern) => pattern.test(userText))
  );
}

export function hasSignupAccountIdentifier(userText: string | null | undefined) {
  return Boolean(userText && EMAIL_ADDRESS_PATTERN.test(userText));
}

export function normalizeBrowserService(service: string | null | undefined) {
  return service ? service.trim().toLowerCase() : null;
}

function buildGoogleSearchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function cleanClickyResearchQuery(task: string) {
  const query = task
    .replace(/\bclicky\b/gi, "")
    .replace(/\b(?:open|use|visit|go(?:es)?\s+on|navigate\s+to)\s+(?:a\s+|the\s+)?(?:website|web\s*site|browser|page)\b/gi, "")
    .replace(/\b(?:then|and)\s+show\s+(?:it|this|that)?\s*(?:to\s+)?(?:me|user)\b/gi, "")
    .replace(/\b(?:finds?|take|capture)\s+screenshots?\b/gi, "screenshots")
    .replace(/\blog(?:s)?\s*in\b/gi, "login flow")
    .replace(/\s+/g, " ")
    .trim();

  if (!query) {
    return "competitor product screenshots pricing onboarding dashboard";
  }

  const additions = new Set<string>();
  if (/\bcompetitors?\b/i.test(task)) {
    additions.add("competitors");
  }
  if (/\bscreenshots?\b/i.test(task)) {
    additions.add("screenshots");
  }
  if (/\b(?:product\s+like|similar\s+to|inspired\s+by|dashboard|onboarding|pricing)\b/i.test(task)) {
    additions.add("product UI pricing onboarding dashboard");
  }

  return [query, ...additions].join(" ").replace(/\s+/g, " ").trim();
}

function inferClickyResearchSearchUrl(task: string) {
  const normalizedTask = task.trim();
  if (
    !hasClickyOperatorBrowserIntent(normalizedTask) ||
    !CLICKY_RESEARCH_SEARCH_PATTERN.test(normalizedTask)
  ) {
    return null;
  }

  const hasDomain = DOMAIN_LIKE_PATTERN.test(normalizedTask);
  const shouldSearchAroundDomain = hasDomain && COMPETITOR_OF_PATTERN.test(normalizedTask);
  if (hasDomain && !shouldSearchAroundDomain) {
    return null;
  }

  if (hasBrowserAuthIntent(normalizedTask) && findQuickOpenTarget(normalizedTask)) {
    return null;
  }

  return buildGoogleSearchUrl(cleanClickyResearchQuery(normalizedTask));
}

export function inferQuickStartUrl(task: string, service?: string | null) {
  const clickyResearchSearchUrl = inferClickyResearchSearchUrl(task);
  if (clickyResearchSearchUrl) {
    return clickyResearchSearchUrl;
  }

  const quickTarget =
    findQuickOpenTarget(normalizeBrowserService(service)) ??
    findQuickOpenTarget(task);
  if (quickTarget) {
    if (hasBrowserLoginIntent(task) && quickTarget.loginUrl) {
      return quickTarget.loginUrl;
    }

    return quickTarget.url;
  }

  const domainMatch = task.match(
    /\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s]*)?/i
  );
  if (domainMatch?.[1]) {
    const domainUrl = `https://${domainMatch[1]}`;
    const quickTarget = findQuickOpenTargetByUrl(domainUrl);
    if (quickTarget && hasBrowserLoginIntent(task) && quickTarget.loginUrl) {
      return quickTarget.loginUrl;
    }

    return domainUrl;
  }

  return null;
}

export function describeQuickOpenTarget(
  service: string | null | undefined,
  startUrl: string
) {
  const quickTarget =
    findQuickOpenTarget(normalizeBrowserService(service)) ??
    findQuickOpenTargetByUrl(startUrl);
  if (quickTarget) {
    return quickTarget.label;
  }

  try {
    const hostname = new URL(startUrl).hostname.replace(/^www\./, "");
    return hostname || "the page";
  } catch {
    return "the page";
  }
}

export function buildBrowserTaskInstruction(params: {
  userText: string;
  startUrl: string | null;
  targetLabel: string;
}) {
  const { userText, startUrl, targetLabel } = params;
  const trimmedUserText = userText.trim();

  if (hasClickyOperatorBrowserIntent(trimmedUserText)) {
    const destination = startUrl
      ? `${targetLabel} at ${startUrl}`
      : targetLabel && targetLabel !== "the requested page"
        ? targetLabel
        : "the requested website or competitor page";
    const desktopContext = OPERATOR_DESKTOP_CONTEXT_PATTERN.test(trimmedUserText)
      ? "If the task depends on a local desktop app, report that a desktop workflow is needed for the app portion and continue only with the browser portion you can safely perform."
      : "";

    return [
      `Act as Maria's browser operator for: ${trimmedUserText}`,
      `Open or navigate to ${destination}.`,
      "Inspect the relevant public pages, competitor pages, product flows, pricing, onboarding, dashboards, UI patterns, copy, and visible evidence.",
      "If sign-in is required, use only user-approved browser-held credentials or pause for the user to complete passwords, one-time codes, recovery codes, CAPTCHA, or payment steps directly in the browser.",
      "Capture screenshots or visual evidence when the runtime supports it, and keep track of page URLs, titles, important findings, blockers, and follow-up questions.",
      "Do not submit purchases, destructive changes, account changes, messages, or forms unless the user explicitly approved that exact final action.",
      hasClickyProductBuildIntent(trimmedUserText)
        ? buildClickyProductBuildDeliverableInstruction()
        : "Finish by showing the user what was found, what screenshots/evidence were captured, what could not be accessed, and practical product ideas or implementation notes inspired by the research.",
      "Keep the browser open so the user can inspect or continue the session.",
      desktopContext,
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (hasBrowserAuthIntent(trimmedUserText)) {
    const flowLabel = SIGNUP_INTENT_PATTERN.test(trimmedUserText)
      ? "account creation"
      : "sign-in";
    const destination = startUrl
      ? `${targetLabel} at ${startUrl}`
      : targetLabel;

    return [
      `Open ${destination} and complete the full ${flowLabel} flow autonomously on behalf of the user.`,
      `If a general landing page appears first, navigate to the ${flowLabel} page.`,
      "Scan the full page text, links, buttons, and forms before deciding the page is missing the target.",
      "If needed, scroll through the page and try safe visible signup/sign-in candidates such as links or buttons.",
      "If the target is still not visible, try likely same-site routes for the requested flow before stopping.",
      "Once the signup or login form is visible, check the KEY MEMORIES block for any saved email address or account identifier for this site. If found, use it to fill the email field directly.",
      "If no saved credentials are found in memory, call askUser with purpose signup_account_identifier to request the email and password from the user, then enter the provided values into the form fields.",
      "After filling in the credentials, submit the form to complete the signup or login. Do not stop at the form — the user's request to sign up or log in is already their approval.",
      "When the signup or login succeeds, immediately call saveMemory with a masked credential note in this exact format: 'Site credential: [site domain] — email: [the email used] — password set by user'. Set memoryType to 'context', importance to 9, and tags to ['credential', 'login', site domain]. Do NOT include the raw password in the memory content — only note that it was set.",
      "When done, report the outcome clearly: state that the account was created or login was successful (and that the credential has been saved to memory for next time), or explain exactly what went wrong.",
      "Only pause and keep the browser open if a 2FA code, OTP, CAPTCHA, recovery code, or payment step is encountered — these genuinely require the user to act. Tell the user exactly what is blocking and what they need to do.",
    ].join(" ");
  }

  return startUrl
    ? `Open ${targetLabel} at ${startUrl}. Scan the page for the requested target, scroll if needed, and keep the browser open.`
    : trimmedUserText;
}

export function hasClickyOperatorBrowserIntent(userText: string | null | undefined) {
  const normalizedText = userText?.trim() ?? "";
  if (!normalizedText) {
    return false;
  }

  if (detectTradingPairIntent(normalizedText)) {
    return false;
  }

  if (FILE_PATH_PATTERN.test(normalizedText) || FILE_EXTENSION_PATTERN.test(normalizedText)) {
    return false;
  }

  return OPERATOR_BROWSER_WORKFLOW_PATTERN.test(normalizedText);
}

export function hasClickyProductBuildIntent(userText: string | null | undefined) {
  const normalizedText = userText?.trim() ?? "";
  return Boolean(normalizedText && PRODUCT_BUILD_FROM_RESEARCH_PATTERN.test(normalizedText));
}

export function buildClickyProductBuildDeliverableInstruction() {
  return [
    "Finish by turning the evidence into a build-ready product brief, not just a summary.",
    "Include: 1. evidence captured with URLs/titles/screenshots; 2. what to copy conceptually and what to avoid copying directly; 3. target user and core job-to-be-done; 4. MVP feature list; 5. UX flow and screen map; 6. component/backlog checklist; 7. data model and API notes; 8. copywriting direction; 9. visual asset prompts or references; 10. first implementation steps for Rearvy/Maria.",
    "If access was blocked, still produce the best safe spec from visible public evidence and list the missing evidence separately.",
  ].join(" ");
}

export function getBrowserTaskStrategy(params: {
  userText: string;
  startUrl: string | null;
}): "goal-seeking" | "open-only" {
  const normalizedText = params.userText.trim();
  if (!normalizedText || !params.startUrl) {
    return "goal-seeking";
  }

  if (
    hasBrowserAuthIntent(normalizedText) ||
    hasClickyOperatorBrowserIntent(normalizedText)
  ) {
    return "goal-seeking";
  }

  return DIRECT_BROWSER_COMMAND_PATTERN.test(normalizedText)
    ? "open-only"
    : "goal-seeking";
}

export function shouldForceBrowserTaskFirstStep(userText: string) {
  const normalizedText = userText.trim();
  if (!normalizedText) {
    return false;
  }

  if (detectTradingPairIntent(normalizedText)) {
    return false;
  }

  if (EXPLICIT_BROWSER_WORKFLOW_PATTERN.test(normalizedText)) {
    return true;
  }

  if (hasClickyOperatorBrowserIntent(normalizedText)) {
    return true;
  }

  if (
    hasBrowserAuthIntent(normalizedText) &&
    (DOMAIN_LIKE_PATTERN.test(normalizedText) ||
      findQuickOpenTarget(normalizedText))
  ) {
    return true;
  }

  if (!DIRECT_BROWSER_COMMAND_PATTERN.test(normalizedText)) {
    return false;
  }

  const destination = normalizedText
    .replace(DIRECT_BROWSER_COMMAND_PATTERN, "")
    .trim()
    .replace(/[.?!]+$/, "");

  if (!destination) {
    return false;
  }

  if (REPEAT_ONLY_DESTINATION_PATTERN.test(destination)) {
    return false;
  }

  if (FILE_PATH_PATTERN.test(destination) || FILE_EXTENSION_PATTERN.test(destination)) {
    return false;
  }

  if (DOMAIN_LIKE_PATTERN.test(destination) || findQuickOpenTarget(destination)) {
    return true;
  }

  if (NON_WEB_TARGET_PATTERN.test(destination)) {
    return false;
  }

  const wordCount = destination.split(/\s+/).filter(Boolean).length;
  if (wordCount === 0 || wordCount > 3) {
    return false;
  }

  return FALLBACK_SITE_LIKE_PATTERN.test(destination);
}

export function shouldAskForSignupTarget(userText: string) {
  const normalizedText = userText.trim();
  if (!normalizedText || !hasBrowserAuthIntent(normalizedText)) {
    return false;
  }

  if (DOMAIN_LIKE_PATTERN.test(normalizedText) || findQuickOpenTarget(normalizedText)) {
    return false;
  }

  return true;
}

export function shouldAskForSignupAccountIdentifier(userText: string) {
  const normalizedText = userText.trim();
  if (!normalizedText || !hasBrowserSignupIntent(normalizedText)) {
    return false;
  }

  if (hasSignupAccountIdentifier(normalizedText)) {
    return false;
  }

  return DOMAIN_LIKE_PATTERN.test(normalizedText) || Boolean(findQuickOpenTarget(normalizedText));
}
