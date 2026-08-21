import { normalizeRearvyDisplayText } from "@/lib/brand-display";

export type FollowRequestProfileMetadata = {
  name: string | null;
  username: string | null;
};

function trimmedStringOrNull(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getFollowRequestProfileMetadata(
  profile: Record<string, unknown> | null | undefined
): FollowRequestProfileMetadata {
  return {
    name: normalizeRearvyDisplayText(profile?.full_name),
    username: trimmedStringOrNull(profile?.username),
  };
}
