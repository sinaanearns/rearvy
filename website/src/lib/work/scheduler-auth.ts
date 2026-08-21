import { timingSafeEqual } from "crypto";

type SchedulerRequestLike = {
  headers: Pick<Headers, "get">;
  nextUrl: Pick<URL, "searchParams">;
};

function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isWorkSchedulerRequestAuthorized(
  request: SchedulerRequestLike,
  workerSecret: string
) {
  if (!workerSecret) {
    return false;
  }

  const providedSecret =
    request.headers.get("x-work-scheduler-secret") ||
    request.headers.get("x-agent-events-worker-secret") ||
    request.headers.get("x-sync-worker-secret") ||
    request.nextUrl.searchParams.get("secret");

  return secretsMatch(providedSecret, workerSecret);
}

export function normalizeSchedulerLimit(value: string | null) {
  const parsedLimit = Number(value || 25);
  return Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.floor(parsedLimit), 1), 100)
    : 25;
}
