export const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const zonedFormatters = new Map<string, Intl.DateTimeFormat>();

function getZonedFormatter(timeZone: string) {
  const cached = zonedFormatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  zonedFormatters.set(timeZone, formatter);
  return formatter;
}

function zonedParts(date: Date, timeZone = BUSINESS_TIME_ZONE): ZonedDateTimeParts {
  const parts = getZonedFormatter(timeZone).formatToParts(date);
  const valueFor = (type: keyof ZonedDateTimeParts) => {
    const value = parts.find((part) => part.type === type)?.value;
    return value ? Number(value) : 0;
  };

  return {
    year: valueFor("year"),
    month: valueFor("month"),
    day: valueFor("day"),
    hour: valueFor("hour"),
    minute: valueFor("minute"),
    second: valueFor("second"),
  };
}

function timeZoneOffsetMs(date: Date, timeZone = BUSINESS_TIME_ZONE) {
  const parts = zonedParts(date, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return localAsUtc - date.getTime();
}

function zonedDateTimeToDate(parts: ZonedDateTimeParts, timeZone = BUSINESS_TIME_ZONE) {
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const firstPass = new Date(localAsUtc - timeZoneOffsetMs(new Date(localAsUtc), timeZone));
  return new Date(localAsUtc - timeZoneOffsetMs(firstPass, timeZone));
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: 0,
    minute: 0,
    second: 0,
  };
  if (!parsed.year || parsed.month < 1 || parsed.month > 12 || parsed.day < 1 || parsed.day > 31) {
    return null;
  }
  return parsed;
}

function utcDateKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function businessDateKey(date: Date, timeZone = BUSINESS_TIME_ZONE) {
  const parts = zonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function parseBusinessDateKey(value: string, timeZone = BUSINESS_TIME_ZONE) {
  const parsed = parseDateKey(value);
  if (!parsed) return null;
  const date = zonedDateTimeToDate(parsed, timeZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function businessDayBounds(date: Date, timeZone = BUSINESS_TIME_ZONE) {
  const parts = zonedParts(date, timeZone);
  const start = zonedDateTimeToDate({ ...parts, hour: 0, minute: 0, second: 0 }, timeZone);
  const nextDay = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const nextStart = zonedDateTimeToDate(
    {
      year: nextDay.getUTCFullYear(),
      month: nextDay.getUTCMonth() + 1,
      day: nextDay.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  );

  return { start, end: new Date(nextStart.getTime() - 1) };
}

function isUtcMidnight(date: Date) {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}

function isBusinessMidnight(date: Date) {
  const parts = zonedParts(date);
  return parts.hour === 0 && parts.minute === 0 && parts.second === 0 && date.getMilliseconds() === 0;
}

export function normalizeDateOnlyBoundary(date: Date) {
  if (!isUtcMidnight(date)) return date;
  return parseBusinessDateKey(utcDateKey(date)) ?? date;
}

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function formatDateShort(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeShort(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", "");
}

export function toDatetimeLocalValue(date: Date) {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function parseDatetimeLocal(value: FormDataEntryValue | null) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDateOnly(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return parseBusinessDateKey(trimmed);
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function toDateInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatDateOnly(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function isMidnight(date: Date) {
  return (
    isUtcMidnight(date) ||
    isBusinessMidnight(date) ||
    (
      date.getHours() === 0 &&
      date.getMinutes() === 0 &&
      date.getSeconds() === 0 &&
      date.getMilliseconds() === 0
    )
  );
}

/**
 * Daycare and pet sitting store endsAt as the day after the selected date.
 * Boarding stores endsAt as the actual check-out date and exclusive billing boundary.
 */
export function reservationEndDay(endsAt: Date, kind?: string | null): Date {
  if (
    (kind === "DAYCARE" || kind === "PET_SITTING") &&
    isMidnight(endsAt)
  ) {
    return addDays(endsAt, -1);
  }
  return endsAt;
}

export function formatReservationPeriod(startsAt: Date, endsAt: Date, kind?: string | null): string {
  const endDisplay = reservationEndDay(endsAt, kind);
  const start = formatDateOnly(startsAt);
  const end = formatDateOnly(endDisplay);
  return start === end ? start : `${start} - ${end}`;
}
