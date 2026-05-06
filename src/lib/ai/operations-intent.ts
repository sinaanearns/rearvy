export type OperationsCapability =
  | "automation"
  | "assets"
  | "meetings"
  | "investor"
  | "morning_brief";

export type OperationsCapabilityIntent = {
  capability: OperationsCapability;
  reason: string;
};

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function detectOperationsCapabilityIntent(
  userText: string | null | undefined
): OperationsCapabilityIntent | null {
  const text = userText?.trim();
  if (!text) {
    return null;
  }

  if (
    matchesAny(text, [
      /\b(morning|daily|overnight)\s+(brief|briefing|review|digest)\b/i,
      /\bwhat changed overnight\b/i,
      /\bovernight\s+(risks?|kpis?|updates?)\b/i,
    ])
  ) {
    return {
      capability: "morning_brief",
      reason: "The request asks for a brief, digest, or overnight review.",
    };
  }

  if (
    matchesAny(text, [
      /\b(investor|fundraising|board)\s+(update|packet|deck|memo|materials?)\b/i,
      /\b(board packet|board deck|investor memo|investor update|fundraising update)\b/i,
    ])
  ) {
    return {
      capability: "investor",
      reason: "The request asks for investor or board-ready work.",
    };
  }

  if (
    matchesAny(text, [
      /\b(meeting|call)\s+(transcript|notes?|summary|recap)\b/i,
      /\bextract\s+(commitments?|owners?|action items?|follow-?ups?)\b/i,
      /\b(action items?|follow-?ups?|commitments?)\s+from\s+(this\s+)?(meeting|call|transcript)\b/i,
    ])
  ) {
    return {
      capability: "meetings",
      reason: "The request asks to turn meeting content into structured follow-up.",
    };
  }

  if (
    matchesAny(text, [
      /\b(automate|automation|workflow|run log|replayable steps?)\b/i,
      /\b(browser task|run browser|open .* browser|python script|run python|scripted workflow)\b/i,
    ])
  ) {
    return {
      capability: "automation",
      reason: "The request asks for automation or scripted execution.",
    };
  }

  if (
    matchesAny(text, [
      /\b(generate|draft|create|make|prepare|design)\b.*\b(assets?|creative|campaign|variants?|deck pages?|previews?)\b/i,
      /\b(campaign assets?|creative previews?|asset variants?|publishable previews?|board-ready output)\b/i,
    ])
  ) {
    return {
      capability: "assets",
      reason: "The request asks for asset, creative, campaign, or deck output.",
    };
  }

  return null;
}
