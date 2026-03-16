import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";

export type DateInput = Date | string | null | undefined;

export function toDateFromUnix(timestamp: number | null | undefined): Date | null {
  if (!timestamp) return null;
  return new Date(timestamp * 1000);
}

export function toDate(input: DateInput): Date | null {
  if (!input) return null;

  const date = typeof input === "string" ? parseISO(input) : input;
  if (isValid(date)) return date;

  if (typeof input === "string") {
    const fallback = new Date(input);
    return isValid(fallback) ? fallback : null;
  }

  return null;
}

export function formatShortDate(input: DateInput, fallback = "—") {
  const date = toDate(input);
  if (!date) return fallback;
  return format(date, "MMM d, yyyy");
}

/** Format a date range like "Jan 5, 2026 - Jan 7, 2026". */
export function formatDateRange(start: DateInput, end: DateInput, fallback = "—") {
  if (!start && !end) return fallback;
  if (start && end)
    return `${formatShortDate(start, fallback)} - ${formatShortDate(end, fallback)}`;
  return formatShortDate(start ?? end, fallback);
}

/** Format a date range like "January 5 – 7, 2026" using Intl smart range formatting. */
export function formatLongDateRange(
  start: DateInput,
  end: DateInput,
  fallback?: undefined,
): string | undefined;
export function formatLongDateRange(start: DateInput, end: DateInput, fallback: string): string;
export function formatLongDateRange(start: DateInput, end: DateInput, fallback?: string) {
  const startDate = toDate(start);
  if (!startDate) return fallback;
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const endDate = toDate(end);
  if (!endDate) return fmt.format(startDate);
  return fmt.formatRange(startDate, endDate);
}

export function formatLongDate(input: DateInput, fallback = "—") {
  const date = toDate(input);
  if (!date) return fallback;
  return format(date, "MMMM d, yyyy");
}

/** Format a date as `YYYY-MM-DDTHH:mm` in the given IANA timezone for datetime-local inputs. */
export function formatDateTimeLocalInTimeZone(input: DateInput, timezone: string, fallback = "") {
  const date = toDate(input);
  if (!date) return fallback;

  const formatted = new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(date);

  return formatted.replace(" ", "T");
}

function getTimeZoneOffsetMs(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return asUtc - date.getTime();
}

/** Format a time like "3:30 PM" in the given IANA timezone. */
export function formatTimeTz(input: DateInput, timezone: string, fallback = "—") {
  const date = toDate(input);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

/** Format a date like "Mon, Jan 5" in the given IANA timezone. */
export function formatShortDateTz(input: DateInput, timezone: string, fallback = "—") {
  const date = toDate(input);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  }).format(date);
}

/** Format a time range like "3:30 PM – 5:00 PM" in the given IANA timezone. */
export function formatTimeRangeTz(
  start: DateInput,
  end: DateInput,
  timezone: string,
  fallback = "—",
) {
  const s = formatTimeTz(start, timezone, fallback);
  const e = formatTimeTz(end, timezone, fallback);
  if (s === fallback && e === fallback) return fallback;
  return `${s} – ${e}`;
}

/** Format the duration between two dates as a human-readable string (e.g., "2h 30m"). */
export function formatDuration(start: DateInput, end: DateInput, fallback = "—") {
  const startDate = toDate(start);
  const endDate = toDate(end);
  if (!startDate || !endDate) return fallback;
  const ms = endDate.getTime() - startDate.getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

/** Format a date as a short relative time string (e.g., "2m ago", "3h ago", "5d ago"). */
export function formatRelativeTime(input: DateInput, fallback = "—") {
  const date = toDate(input);
  if (!date) return fallback;
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

/** Format a countdown string like "3d 2h 15m" from a future date. Returns "Starting now" if past. */
export function formatCountdown(input: DateInput, fallback = "—") {
  const date = toDate(input);
  if (!date) return fallback;

  const diff = date.getTime() - Date.now();
  if (diff <= 0) return "Starting now";

  const totalMinutes = Math.floor(diff / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  const remMinutes = totalMinutes % 60;

  if (days === 0 && remHours === 0) return `${remMinutes}m`;
  if (days === 0) return `${remHours}h ${remMinutes}m`;
  return `${days}d ${remHours}h ${remMinutes}m`;
}

/** Format a date as "Jan 2026" (month + year only). */
export function formatMonthYear(input: DateInput, fallback = "—") {
  const date = toDate(input);
  if (!date) return fallback;
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

/** Format a date range like "Jan 5 – 7" in the given IANA timezone. */
export function formatDateRangeTz(
  start: DateInput,
  end: DateInput,
  timezone: string,
  fallback = "—",
) {
  const startDate = toDate(start);
  if (!startDate) return fallback;

  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });

  const endDate = toDate(end);
  if (!endDate) return fmt.format(startDate);
  return fmt.formatRange(startDate, endDate);
}

/**
 * Parse a datetime-local value (YYYY-MM-DDTHH:mm) as a wall-clock time in the given timezone.
 * Returns the corresponding UTC Date instant, or null if parsing fails.
 */
export function parseDateTimeLocalInTimeZone(value: string, timezone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  const offset1 = getTimeZoneOffsetMs(utcGuess, timezone);
  let utcMs = utcGuess.getTime() - offset1;

  // One correction pass handles DST transition boundaries more reliably.
  const corrected = new Date(utcMs);
  const offset2 = getTimeZoneOffsetMs(corrected, timezone);
  if (offset2 !== offset1) {
    utcMs = utcGuess.getTime() - offset2;
  }

  return new Date(utcMs);
}
