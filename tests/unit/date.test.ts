import { describe, expect, it } from "vitest";
import {
  businessDateKey,
  businessDateParts,
  businessDayBounds,
  formatReservationPeriod,
  normalizeDateOnlyBoundary,
  parseDateOnly,
  reservationEndDay,
  reservationOverlapsDay,
  toDateInputValue,
} from "@/lib/date";

describe("reservation date helpers", () => {
  it("parses date-only form values at the start of the Brazil business day", () => {
    expect(parseDateOnly("2026-05-22")?.toISOString()).toBe("2026-05-22T03:00:00.000Z");
  });

  it("keeps Brazil day bounds when the server UTC date has already advanced", () => {
    const now = new Date("2026-05-22T02:30:00.000Z");
    const { start, end } = businessDayBounds(now);

    expect(businessDateKey(now)).toBe("2026-05-21");
    expect(businessDateParts(now)).toEqual({ year: 2026, month: 5, day: 21 });
    expect(start.toISOString()).toBe("2026-05-21T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-05-22T02:59:59.999Z");
  });

  it("interprets legacy UTC-midnight reservation dates as Brazil date boundaries", () => {
    expect(normalizeDateOnlyBoundary(new Date("2026-05-22T00:00:00.000Z")).toISOString())
      .toBe("2026-05-22T03:00:00.000Z");
  });

  it("keeps the selected boarding check-out date visible", () => {
    const checkout = new Date(2026, 5, 24);

    expect(toDateInputValue(reservationEndDay(checkout, "BOARDING"))).toBe("2026-06-24");
  });

  it("keeps legacy UTC-midnight date-only values on the intended business date for inputs", () => {
    expect(toDateInputValue(new Date("2026-06-24T00:00:00.000Z"))).toBe("2026-06-24");
  });

  it("displays boarding stays using the check-out date", () => {
    expect(
      formatReservationPeriod(new Date(2026, 5, 22), new Date(2026, 5, 24), "BOARDING"),
    ).toBe("22/06/2026 - 24/06/2026");
  });

  it("displays daycare as the selected single date", () => {
    expect(
      formatReservationPeriod(new Date(2026, 5, 22), new Date(2026, 5, 23), "DAYCARE"),
    ).toBe("22/06/2026");
  });

  it("does not count daycare on the synthetic exclusive end day", () => {
    const startsAt = parseDateOnly("2026-05-28")!;
    const endsAt = parseDateOnly("2026-05-29")!;
    const { start, end } = businessDayBounds(parseDateOnly("2026-05-29")!);

    expect(
      reservationOverlapsDay({ startsAt, endsAt, serviceKind: "DAYCARE" }, start, end),
    ).toBe(false);
  });

  it("keeps boarding visible on the selected check-out day", () => {
    const startsAt = parseDateOnly("2026-05-28")!;
    const endsAt = parseDateOnly("2026-05-29")!;
    const { start, end } = businessDayBounds(parseDateOnly("2026-05-29")!);

    expect(
      reservationOverlapsDay({ startsAt, endsAt, serviceKind: "BOARDING" }, start, end),
    ).toBe(true);
  });
});
