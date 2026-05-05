import { cache } from "react";

export type AnthropicDirectoryCategory = "skills" | "connectors" | "plugins";

export type AnthropicDirectorySource =
  | "Anthropic"
  | "Anthropic verified"
  | "Partners";

export type AnthropicDirectoryItem = {
  title: string;
  description: string;
  href: string;
  slug: string;
  kind: AnthropicDirectoryCategory;
  source: AnthropicDirectorySource;
  installs?: number | null;
  rank: number;
  featured?: boolean;
};

export type AnthropicDirectoryCatalog = Record<AnthropicDirectoryCategory, AnthropicDirectoryItem[]>;

const DIRECTORY_REVALIDATE_SECONDS = 60 * 60 * 24;
const CONNECTOR_PAGE_COUNT = 12;
const PLUGIN_PAGE_COUNT = 2;

const BUILTIN_SKILLS: AnthropicDirectoryItem[] = [
  {
    title: "Simplify",
    description: "Reduce messy context into a concise plan, summary, or answer.",
    href: "https://code.claude.com/docs",
    slug: "simplify",
    kind: "skills",
    source: "Anthropic",
    rank: 0,
    featured: true,
  },
  {
    title: "Batch",
    description: "Group repetitive work into efficient batches across files or tasks.",
    href: "https://code.claude.com/docs",
    slug: "batch",
    kind: "skills",
    source: "Anthropic",
    rank: 1,
    featured: true,
  },
  {
    title: "Debug",
    description: "Inspect failures, reproduce issues, and narrow the root cause.",
    href: "https://code.claude.com/docs",
    slug: "debug",
    kind: "skills",
    source: "Anthropic",
    rank: 2,
    featured: true,
  },
  {
    title: "Loop",
    description: "Iterate on a task with feedback, retries, and checkpoints.",
    href: "https://code.claude.com/docs",
    slug: "loop",
    kind: "skills",
    source: "Anthropic",
    rank: 3,
    featured: true,
  },
  {
    title: "Claude API",
    description: "Bridge Claude Code with API-oriented workflows and examples.",
    href: "https://code.claude.com/docs",
    slug: "claude-api",
    kind: "skills",
    source: "Anthropic",
    rank: 4,
    featured: true,
  },
];

function decodeHtml(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();

    if (lower === "nbsp") return " ";
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return match;
  });
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function slugToTitle(slug: string) {
  return decodeHtml(slug.replace(/[-_]+/g, " ")).replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractInstallCount(blockText: string) {
  const match = blockText.match(/([\d,]+)\s+installs?/i);

  if (!match?.[1]) {
    return null;
  }

  const value = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function getSource(kind: Exclude<AnthropicDirectoryCategory, "skills">, blockText: string) {
  if (kind === "connectors") {
    return "Partners" as const;
  }

  return /Anthropic verified/i.test(blockText) ? ("Anthropic verified" as const) : ("Partners" as const);
}

function parseDirectoryPage(
  html: string,
  kind: Exclude<AnthropicDirectoryCategory, "skills">,
  pageNumber: number
) {
  const itemRegex = new RegExp(
    `<a[^>]+href="(?<href>\/${kind}\/[^\"]+)"[^>]*>(?<block>[\\s\\S]*?)<\/a>`,
    "gms"
  );
  const items: AnthropicDirectoryItem[] = [];

  for (const match of html.matchAll(itemRegex)) {
    const href = match.groups?.href;
    const block = match.groups?.block;

    if (!href || !block) {
      continue;
    }

    const slug = href.split("/").filter(Boolean).pop() || "";
    const title = stripHtml(
      match.groups?.block.match(/<h3[^>]*>(?<title>[\s\S]*?)<\/h3>/)?.groups?.title ||
        slugToTitle(slug)
    );
    const description = stripHtml(
      match.groups?.block.match(/<p[^>]*>(?<description>[\s\S]*?)<\/p>/)?.groups?.description || ""
    );
    const blockText = stripHtml(block);

    items.push({
      title,
      description,
      href: href.startsWith("http") ? href : `https://claude.com${href}`,
      slug,
      kind,
      source: getSource(kind, blockText),
      installs: extractInstallCount(blockText),
      rank: pageNumber * 1000 + items.length,
    });
  }

  return items;
}

async function fetchDirectoryPages(
  baseUrl: string,
  kind: Exclude<AnthropicDirectoryCategory, "skills">,
  pageCount: number
) {
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1);
  const pageResults = await Promise.all(
    pageNumbers.map(async (pageNumber) => {
      const url = pageNumber === 1 ? baseUrl : `${baseUrl}?cc61befa_page=${pageNumber}`;

      try {
        const response = await fetch(url, {
          next: {
            revalidate: DIRECTORY_REVALIDATE_SECONDS,
          },
        });

        if (!response.ok) {
          return [] as AnthropicDirectoryItem[];
        }

        const html = await response.text();
        return parseDirectoryPage(html, kind, pageNumber);
      } catch {
        return [] as AnthropicDirectoryItem[];
      }
    })
  );

  const seen = new Set<string>();
  const items: AnthropicDirectoryItem[] = [];

  for (const pageItems of pageResults) {
    for (const item of pageItems) {
      if (seen.has(item.href)) {
        continue;
      }

      seen.add(item.href);
      items.push(item);
    }
  }

  return items;
}

function isSkillFocusedPlugin(item: AnthropicDirectoryItem) {
  const haystack = `${item.title} ${item.description} ${item.slug}`.toLowerCase();

  if (item.title === "Ralph Loop" || item.title === "Remember") {
    return true;
  }

  return /skill|skills|toolkit|output style|loop|commit commands|security guidance|pr review toolkit|claude code setup|pagerduty pre-commit risk score|aikido security/.test(
    haystack
  );
}

function sortByRank(left: AnthropicDirectoryItem, right: AnthropicDirectoryItem) {
  return left.rank - right.rank || left.title.localeCompare(right.title);
}

export const loadAnthropicDirectory = cache(async (): Promise<AnthropicDirectoryCatalog> => {
  const [connectors, plugins] = await Promise.all([
    fetchDirectoryPages("https://claude.com/connectors", "connectors", CONNECTOR_PAGE_COUNT),
    fetchDirectoryPages("https://claude.com/plugins", "plugins", PLUGIN_PAGE_COUNT),
  ]);

  const skillPlugins = plugins
    .filter(isSkillFocusedPlugin)
    .map((item, index) => ({
      ...item,
      kind: "skills" as const,
      rank: 1000 + index,
    }));

  const skills = [...BUILTIN_SKILLS, ...skillPlugins].sort(sortByRank);

  return {
    skills,
    connectors,
    plugins,
  };
});
