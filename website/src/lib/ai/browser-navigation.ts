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

export function inferQuickStartUrl(task: string, service?: string | null) {
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

  if (hasBrowserAuthIntent(trimmedUserText)) {
    const flowLabel = SIGNUP_INTENT_PATTERN.test(trimmedUserText)
      ? "account creation"
      : "sign-in";
    const destination = startUrl
      ? `${targetLabel} at ${startUrl}`
      : targetLabel;

    return [
      `Open ${destination} for ${flowLabel}.`,
      `If a general landing page appears first, navigate to the ${flowLabel} page.`,
      "Scan the full page text, links, buttons, and forms before deciding the page is missing the target.",
      "If needed, scroll through the page and try safe visible signup/sign-in candidates such as links or buttons.",
      "If the target is still not visible, try likely same-site routes for the requested flow before stopping.",
      "Stop before entering passwords, one-time codes, recovery codes, payment details, or completing CAPTCHA.",
      "Keep the browser open so the user can finish sensitive steps directly in the browser.",
    ].join(" ");
  }

  return startUrl
    ? `Open ${targetLabel} at ${startUrl}. Scan the page for the requested target, scroll if needed, and keep the browser open.`
    : trimmedUserText;
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
