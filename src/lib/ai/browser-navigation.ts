function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type QuickOpenTarget = {
  label: string;
  url: string;
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

  return null;
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

export function normalizeBrowserService(service: string | null | undefined) {
  return service ? service.trim().toLowerCase() : null;
}

export function inferQuickStartUrl(task: string, service?: string | null) {
  const quickTarget =
    findQuickOpenTarget(normalizeBrowserService(service)) ??
    findQuickOpenTarget(task);
  if (quickTarget) {
    return quickTarget.url;
  }

  const domainMatch = task.match(
    /\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s]*)?/i
  );
  if (domainMatch?.[1]) {
    return `https://${domainMatch[1]}`;
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

export function shouldForceBrowserTaskFirstStep(userText: string) {
  const normalizedText = userText.trim();
  if (!normalizedText) {
    return false;
  }

  if (EXPLICIT_BROWSER_WORKFLOW_PATTERN.test(normalizedText)) {
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
