import { normalizeHttpUrl } from "@/lib/chat/url-normalization";

export type MediaAnalysisTask = "analyze" | "summarize" | "transcribe";

export type MediaAnalysisType = "auto" | "youtube" | "video" | "audio" | "page";

export type MediaAnalysisIntent = {
  url: string;
  task: MediaAnalysisTask;
  mediaType: MediaAnalysisType;
  prompt: string;
};

const MEDIA_ANALYSIS_VERB_PATTERN =
  /\b(?:analy[sz]e|summari[sz]e|recap|review|inspect|transcribe|transcript|caption|extract\s+key\s+points|key\s+points|tell\s+me\s+about)\b/i;
const MEDIA_TARGET_PATTERN =
  /\b(?:youtube|yt|video|audio|podcast|recording|webinar|clip|reel|short|movie|media|song|track|voice\s+note|lecture)\b/i;
const YOUTUBE_HOST_PATTERN = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i;
const AUDIO_HOST_PATTERN = /(^|\.)soundcloud\.com$|(^|\.)spotify\.com$|(^|\.)podcasts\.apple\.com$/i;
const VIDEO_HOST_PATTERN = /(^|\.)vimeo\.com$|(^|\.)tiktok\.com$|(^|\.)instagram\.com$/i;
const AUDIO_EXTENSION_PATTERN = /\.(?:mp3|m4a|wav|aac|ogg|oga|flac)(?:[?#]|$)/i;
const VIDEO_EXTENSION_PATTERN = /\.(?:mp4|mov|webm|mkv|avi|m4v)(?:[?#]|$)/i;
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/i;

type ExtractedPublicUrl = {
  matchedText: string;
  url: string;
};

function normalizeIntentText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanUrl(value: string) {
  return value
    .trim()
    .replace(/[),.;!?]+$/g, "")
    .replace(/^["'`]+|["'`]+$/g, "");
}

export function extractFirstPublicUrl(text: string | null | undefined) {
  return extractFirstPublicUrlMatch(text)?.url ?? null;
}

function extractFirstPublicUrlMatch(
  text: string | null | undefined
): ExtractedPublicUrl | null {
  const normalized = normalizeIntentText(text);
  const match = normalized.match(URL_PATTERN);
  if (!match?.[0]) {
    return null;
  }

  const url = normalizeHttpUrl(cleanUrl(match[0]));
  return url ? { matchedText: match[0], url } : null;
}

function getUrlHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

export function inferMediaAnalysisType(
  url: string,
  text: string | null | undefined = ""
): MediaAnalysisType {
  const host = getUrlHost(url);
  const normalized = normalizeIntentText(text);

  if (YOUTUBE_HOST_PATTERN.test(host)) {
    return "youtube";
  }

  if (AUDIO_EXTENSION_PATTERN.test(url) || AUDIO_HOST_PATTERN.test(host)) {
    return "audio";
  }

  if (VIDEO_EXTENSION_PATTERN.test(url) || VIDEO_HOST_PATTERN.test(host)) {
    return "video";
  }

  if (/\b(?:audio|podcast|song|track|voice\s+note)\b/i.test(normalized)) {
    return "audio";
  }

  if (/\b(?:video|webinar|clip|reel|short|movie|lecture)\b/i.test(normalized)) {
    return "video";
  }

  return "page";
}

function inferTask(text: string): MediaAnalysisTask {
  if (/\b(?:transcribe|transcript|caption|captions)\b/i.test(text)) {
    return "transcribe";
  }

  if (/\b(?:summari[sz]e|recap|tl;?dr|brief)\b/i.test(text)) {
    return "summarize";
  }

  return "analyze";
}

function cleanPrompt(text: string, url: string, matchedUrlText: string) {
  const withoutSlash = text.replace(/^\/(?:media|analy[sz]e-media|video|audio|transcribe)\b/i, "");
  const withoutUrl = [matchedUrlText, cleanUrl(matchedUrlText), url].reduce(
    (prompt, value) => prompt.replace(value, " "),
    withoutSlash
  );
  const normalizedPrompt = withoutUrl.replace(/\s+/g, " ").trim();

  return (
    normalizedPrompt
      .replace(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?/i, "")
      .replace(/\s+(?:please|thanks|thank you)$/i, "")
      .trim() || "Analyze this media link."
  );
}

export function detectMediaAnalysisIntent(
  userText: string | null | undefined
): MediaAnalysisIntent | null {
  const text = normalizeIntentText(userText);
  if (!text) {
    return null;
  }

  const extractedUrl = extractFirstPublicUrlMatch(text);
  if (!extractedUrl) {
    return null;
  }

  const { matchedText, url } = extractedUrl;
  const isSlashCommand =
    /^\/(?:media|analy[sz]e-media|video|audio|transcribe)\b/i.test(text);
  const mediaType = inferMediaAnalysisType(url, text);
  const hasMediaUrl = mediaType !== "page";
  const hasAnalysisVerb = MEDIA_ANALYSIS_VERB_PATTERN.test(text);
  const hasMediaTarget = MEDIA_TARGET_PATTERN.test(text);

  if (!isSlashCommand && !hasMediaUrl && !(hasAnalysisVerb && hasMediaTarget)) {
    return null;
  }

  if (!hasAnalysisVerb && !isSlashCommand) {
    return null;
  }

  return {
    url,
    task: inferTask(text),
    mediaType,
    prompt: cleanPrompt(text, url, matchedText),
  };
}
