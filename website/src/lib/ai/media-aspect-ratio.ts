export const MEDIA_ASPECT_RATIOS = [
  "4:5",
  "1:1",
  "16:9",
  "9:16",
  "21:9",
  "3:4",
  "4:3",
] as const;

export type MediaAspectRatio = (typeof MEDIA_ASPECT_RATIOS)[number];
export type MediaAspectRatioMode = "image" | "video";

export const DEFAULT_IMAGE_ASPECT_RATIO: MediaAspectRatio = "4:5";
export const DEFAULT_VIDEO_ASPECT_RATIO: MediaAspectRatio = "16:9";

export type MediaAspectRatioPreset = {
  id: string;
  label: string;
  aspectRatio: MediaAspectRatio;
  description: string;
  modes: MediaAspectRatioMode[];
};

export const MEDIA_ASPECT_RATIO_PRESETS: MediaAspectRatioPreset[] = [
  {
    id: "instagram-post",
    label: "Instagram post",
    aspectRatio: "4:5",
    description: "Vertical feed post",
    modes: ["image", "video"],
  },
  {
    id: "instagram-square",
    label: "Instagram square",
    aspectRatio: "1:1",
    description: "Square grid post",
    modes: ["image", "video"],
  },
  {
    id: "youtube",
    label: "YouTube",
    aspectRatio: "16:9",
    description: "Thumbnail or landscape video",
    modes: ["image", "video"],
  },
  {
    id: "story-reel",
    label: "Story / Reel",
    aspectRatio: "9:16",
    description: "Vertical social video",
    modes: ["image", "video"],
  },
  {
    id: "cinematic",
    label: "Cinematic",
    aspectRatio: "21:9",
    description: "Ultra-wide film frame",
    modes: ["image", "video"],
  },
  {
    id: "portrait",
    label: "Portrait",
    aspectRatio: "3:4",
    description: "Classic vertical frame",
    modes: ["image", "video"],
  },
  {
    id: "landscape",
    label: "Landscape",
    aspectRatio: "4:3",
    description: "Classic horizontal frame",
    modes: ["image", "video"],
  },
];

const MEDIA_ASPECT_RATIO_SET = new Set<string>(MEDIA_ASPECT_RATIOS);

const ASPECT_RATIO_ALIASES: Array<{
  pattern: RegExp;
  aspectRatio: MediaAspectRatio;
}> = [
  {
    pattern:
      /\b(?:(?:instagram|insta|ig)\s+(?:story|stories|reel|reels)|(?:story|stories|reel|reels)\s+(?:for\s+)?(?:instagram|insta|ig)|tiktok|youtube\s+shorts?|shorts)\b/i,
    aspectRatio: "9:16",
  },
  {
    pattern:
      /\b(?:(?:youtube|yt)\s+(?:thumbnail|thumb|cover|banner|video)|(?:thumbnail|thumb|cover|banner)\s+(?:for\s+)?(?:youtube|yt))\b/i,
    aspectRatio: "16:9",
  },
  {
    pattern:
      /\b(?:cinematic|ultra\s*wide|ultrawide|wide\s*screen|widescreen|film\s+still|movie\s+still)\b/i,
    aspectRatio: "21:9",
  },
  {
    pattern:
      /\b(?:(?:instagram|insta|ig)\s+(?:post|feed|portrait|ad|creative)|(?:post|feed)\s+(?:for\s+)?(?:instagram|insta|ig)|instagram|insta|ig)\b/i,
    aspectRatio: "4:5",
  },
  {
    pattern: /\b(?:square|profile\s+(?:photo|picture|image)|avatar)\b/i,
    aspectRatio: "1:1",
  },
  {
    pattern: /\b(?:vertical|portrait)\b/i,
    aspectRatio: "4:5",
  },
  {
    pattern: /\b(?:landscape|wide)\b/i,
    aspectRatio: "16:9",
  },
];

function getDefaultMediaAspectRatio(mode: MediaAspectRatioMode) {
  return mode === "image"
    ? DEFAULT_IMAGE_ASPECT_RATIO
    : DEFAULT_VIDEO_ASPECT_RATIO;
}

export function isMediaAspectRatio(value: unknown): value is MediaAspectRatio {
  return typeof value === "string" && MEDIA_ASPECT_RATIO_SET.has(value);
}

export function normalizeMediaAspectRatio(
  value: unknown,
  mode: MediaAspectRatioMode
): MediaAspectRatio {
  return isMediaAspectRatio(value) ? value : getDefaultMediaAspectRatio(mode);
}

export function resolveMediaAspectRatioFromText(
  text: string,
  mode: MediaAspectRatioMode
): MediaAspectRatio {
  const explicitRatio = text.match(/\b([1-9]\d?)\s*(?::|x|by)\s*([1-9]\d?)\b/i);
  if (explicitRatio) {
    const candidate = `${Number(explicitRatio[1])}:${Number(explicitRatio[2])}`;
    if (isMediaAspectRatio(candidate)) {
      return candidate;
    }
  }

  for (const alias of ASPECT_RATIO_ALIASES) {
    if (alias.pattern.test(text)) {
      return alias.aspectRatio;
    }
  }

  return getDefaultMediaAspectRatio(mode);
}

export function getMediaAspectRatioPromptHint(aspectRatio: MediaAspectRatio) {
  const preset = MEDIA_ASPECT_RATIO_PRESETS.find(
    (item) => item.aspectRatio === aspectRatio
  );
  const label = preset?.label ?? "selected format";

  return `Compose for ${label} output in a ${aspectRatio} frame.`;
}

export function withMediaAspectRatioPromptHint(
  prompt: string,
  aspectRatio: MediaAspectRatio
) {
  const hint = getMediaAspectRatioPromptHint(aspectRatio);
  if (prompt.includes(hint)) {
    return prompt;
  }

  return `${prompt.trim().replace(/[.?!]+$/g, "")}. ${hint}`;
}
