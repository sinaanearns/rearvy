export type CronFieldName = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

export type ParsedCronExpression = {
  expression: string;
  fields: Record<CronFieldName, Set<number>>;
  wildcards: Record<CronFieldName, boolean>;
};

const FIELD_RANGES: Record<CronFieldName, { min: number; max: number }> = {
  minute: { min: 0, max: 59 },
  hour: { min: 0, max: 23 },
  dayOfMonth: { min: 1, max: 31 },
  month: { min: 1, max: 12 },
  dayOfWeek: { min: 0, max: 7 },
};

const PRESETS: Record<string, { schedule: string; label: string }> = {
  daily: { schedule: "0 9 * * *", label: "Daily at 09:00" },
  weekdays: { schedule: "0 9 * * 1-5", label: "Weekdays at 09:00" },
  weekly: { schedule: "0 9 * * 1", label: "Weekly on Monday" },
  hourly: { schedule: "0 * * * *", label: "Hourly" },
};

const VALID_TIMEZONES = new Map<string, string>();

function isIntegerString(value: string) {
  return /^-?\d+$/.test(value);
}

function normalizeTimezone(timezone?: string | null) {
  const candidate = typeof timezone === "string" && timezone.trim() ? timezone.trim() : "UTC";
  const cached = VALID_TIMEZONES.get(candidate);
  if (cached) {
    return cached;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate }).format(new Date());
    VALID_TIMEZONES.set(candidate, candidate);
    return candidate;
  } catch {
    VALID_TIMEZONES.set(candidate, "UTC");
    return "UTC";
  }
}

function expandFieldPart(
  part: string,
  fieldName: CronFieldName,
  values: Set<number>
) {
  const range = FIELD_RANGES[fieldName];
  const [basePart, stepPart] = part.split("/");
  const step = stepPart === undefined ? 1 : Number(stepPart);

  if (!Number.isInteger(step) || step < 1 || step > range.max + 1) {
    throw new Error(`Invalid cron step '${stepPart}' in ${fieldName}.`);
  }

  let start = range.min;
  let end = range.max;

  if (basePart !== "*" && basePart !== "?") {
    if (basePart.includes("-")) {
      const [rawStart, rawEnd] = basePart.split("-");
      if (!isIntegerString(rawStart) || !isIntegerString(rawEnd)) {
        throw new Error(`Invalid cron range '${basePart}' in ${fieldName}.`);
      }
      start = Number(rawStart);
      end = Number(rawEnd);
    } else {
      if (!isIntegerString(basePart)) {
        throw new Error(`Invalid cron value '${basePart}' in ${fieldName}.`);
      }
      start = Number(basePart);
      end = Number(basePart);
    }
  }

  if (fieldName === "dayOfWeek") {
    if (start === 7) start = 0;
    if (end === 7) end = 0;
  }

  if (start < range.min || start > range.max || end < range.min || end > range.max) {
    throw new Error(`Cron ${fieldName} value is outside ${range.min}-${range.max}.`);
  }

  if (start <= end) {
    for (let value = start; value <= end; value += step) {
      values.add(fieldName === "dayOfWeek" && value === 7 ? 0 : value);
    }
    return;
  }

  if (fieldName !== "dayOfWeek") {
    throw new Error(`Cron ${fieldName} range cannot wrap around.`);
  }

  for (let value = start; value <= range.max; value += step) {
    values.add(value === 7 ? 0 : value);
  }
  for (let value = range.min; value <= end; value += step) {
    values.add(value === 7 ? 0 : value);
  }
}

function parseField(rawField: string, fieldName: CronFieldName) {
  const field = rawField.trim();
  const range = FIELD_RANGES[fieldName];
  const values = new Set<number>();
  const wildcard = field === "*" || field === "?";

  if (!field) {
    throw new Error(`Cron ${fieldName} is empty.`);
  }

  if (wildcard) {
    for (let value = range.min; value <= range.max; value += 1) {
      values.add(fieldName === "dayOfWeek" && value === 7 ? 0 : value);
    }
    return { values, wildcard };
  }

  for (const part of field.split(",")) {
    if (!part.trim()) {
      throw new Error(`Cron ${fieldName} contains an empty list entry.`);
    }
    expandFieldPart(part.trim(), fieldName, values);
  }

  if (values.size === 0) {
    throw new Error(`Cron ${fieldName} did not produce any valid values.`);
  }

  return { values, wildcard: false };
}

export function parseCronExpression(expression: string): ParsedCronExpression {
  const parts = expression.trim().split(/\s+/).filter(Boolean);
  if (parts.length !== 5) {
    throw new Error("Cron schedules must use five fields: minute hour day month weekday.");
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const parsedMinute = parseField(minute, "minute");
  const parsedHour = parseField(hour, "hour");
  const parsedDayOfMonth = parseField(dayOfMonth, "dayOfMonth");
  const parsedMonth = parseField(month, "month");
  const parsedDayOfWeek = parseField(dayOfWeek, "dayOfWeek");

  return {
    expression: parts.join(" "),
    fields: {
      minute: parsedMinute.values,
      hour: parsedHour.values,
      dayOfMonth: parsedDayOfMonth.values,
      month: parsedMonth.values,
      dayOfWeek: parsedDayOfWeek.values,
    },
    wildcards: {
      minute: parsedMinute.wildcard,
      hour: parsedHour.wildcard,
      dayOfMonth: parsedDayOfMonth.wildcard,
      month: parsedMonth.wildcard,
      dayOfWeek: parsedDayOfWeek.wildcard,
    },
  };
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  return { year, month, day, hour, minute, dayOfWeek };
}

export function isCronDueAt(expression: string, timezone: string, date = new Date()) {
  const parsed = parseCronExpression(expression);
  const zoned = getZonedParts(date, timezone);
  const dayOfMonthMatches = parsed.fields.dayOfMonth.has(zoned.day);
  const dayOfWeekMatches = parsed.fields.dayOfWeek.has(zoned.dayOfWeek);
  const dayMatches =
    parsed.wildcards.dayOfMonth || parsed.wildcards.dayOfWeek
      ? dayOfMonthMatches && dayOfWeekMatches
      : dayOfMonthMatches || dayOfWeekMatches;

  return (
    parsed.fields.minute.has(zoned.minute) &&
    parsed.fields.hour.has(zoned.hour) &&
    parsed.fields.month.has(zoned.month) &&
    dayMatches
  );
}

export function getNextCronRunAt(
  expression: string,
  timezone = "UTC",
  from = new Date()
) {
  parseCronExpression(expression);
  const next = new Date(from.getTime() + 60_000);
  next.setUTCSeconds(0, 0);

  const maxMinutes = 366 * 24 * 60;
  for (let offset = 0; offset < maxMinutes; offset += 1) {
    const candidate = new Date(next.getTime() + offset * 60_000);
    if (isCronDueAt(expression, timezone, candidate)) {
      return candidate.toISOString();
    }
  }

  throw new Error("No matching cron run found within one year.");
}

export function normalizeWorkSchedule(value: unknown) {
  const raw = typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : "0 9 * * 1-5";
  const lower = raw.toLowerCase();

  if (PRESETS[lower]) {
    return PRESETS[lower];
  }

  try {
    const parsed = parseCronExpression(raw);
    return { schedule: parsed.expression, label: parsed.expression };
  } catch {
    return PRESETS.weekdays;
  }
}

