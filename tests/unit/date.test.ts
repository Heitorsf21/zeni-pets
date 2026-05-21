import { describe, expect, it } from "vitest";
import {
  formatReservationPeriod,
  reservationEndDay,
  toDateInputValue,
} from "@/lib/date";

describe("reservation date helpers", () => {
  it("keeps the selected boarding check-out date visible", () => {
    const checkout = new Date(2026, 5, 24);

    expect(toDateInputValue(reservationEndDay(checkout, "BOARDING"))).toBe("2026-06-24");
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
});
