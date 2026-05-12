import { startOfDay } from "@/lib/date";

export function generateTaskOccurrenceDates(startsAt: Date, endsAt: Date | null): Date[] {
  const start = startOfDay(startsAt);
  const end = startOfDay(endsAt ?? startsAt);
  const dates: Date[] = [];

  for (let date = new Date(start); date.getTime() <= end.getTime(); date.setDate(date.getDate() + 1)) {
    dates.push(new Date(date));
  }

  return dates;
}
