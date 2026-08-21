export function hasCredentialLikeText(value: string) {
  return /\b(?:password|passcode|api\s*key|secret|client\s*secret|access\s*token|refresh\s*token|bearer|private\s*key|credential|otp|2fa|mfa|recovery\s*code)\b/i.test(
    value
  );
}

export function redactSensitiveMemoryText(value: string) {
  return value
    .replace(
      /(https?:\/\/)([^/\s:@]+):([^/\s@]+)@/gi,
      "$1[REDACTED_CREDENTIALS]@"
    )
    .replace(
      /\b(password|passcode|api\s*key|secret|client\s*secret|access\s*token|refresh\s*token|bearer|private\s*key|credential|otp|2fa|mfa|recovery\s*code)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/gi,
      "$1: [REDACTED_SECRET]"
    )
    .replace(
      /\b(sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|xox[baprs]-[A-Za-z0-9-]{12,}|ya29\.[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{12,}|nvapi-[A-Za-z0-9_-]{12,})\b/g,
      "[REDACTED_SECRET]"
    )
    .replace(
      /\b[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
      "[REDACTED_SECRET]"
    );
}
