import { describe, expect, it } from "vitest";
import {
  formatReservationPeriod,
  inclusiveEndDateToExclusiveEnd,
  toDateInputValue,
} from "@/lib/date";

describe("reservation date helpers", () => {
  it("stores the selected check-out date as the next exclusive day", () => {
    const selectedCheckout = new Date(2026, 5, 24);
    const exclusiveEnd = inclusiveEndDateToExclusiveEnd(selectedCheckout);

    expect(toDateInputValue(exclusiveEnd)).toBe("2026-06-25");
  });

  it("displays the inclusive check-out date from an exclusive stored end", () => {
    expect(
      formatReservationPeriod(new Date(2026, 5, 22), new Date(2026, 5, 25)),
    ).toBe("22/06/2026 - 24/06/2026");
  });
});
