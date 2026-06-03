import { describe, expect, it } from "vitest";
import {
  inferReservationEditPricingMode,
  normalizeReservationPricingMode,
} from "@/lib/reservation-pricing-mode";

describe("reservation pricing mode helpers", () => {
  it("normalizes legacy manual mode to manual daily", () => {
    expect(normalizeReservationPricingMode("manual")).toBe("manual_daily");
    expect(normalizeReservationPricingMode("manual_total")).toBe("manual_total");
    expect(normalizeReservationPricingMode(null)).toBe("fixed");
  });

  it("keeps table pricing when the saved base matches the recalculated table base", () => {
    expect(
      inferReservationEditPricingMode({
        persistedMode: "fixed",
        savedBaseAmountCents: 28_000,
        recalculatedFixedBaseCents: 28_000,
      }),
    ).toBe("fixed");
  });

  it("treats a divergent saved base as a manual total when editing", () => {
    expect(
      inferReservationEditPricingMode({
        persistedMode: "fixed",
        savedBaseAmountCents: 30_000,
        recalculatedFixedBaseCents: 28_000,
      }),
    ).toBe("manual_total");
  });

  it("preserves explicit manual modes", () => {
    expect(
      inferReservationEditPricingMode({
        persistedMode: "manual_daily",
        savedBaseAmountCents: 30_000,
        recalculatedFixedBaseCents: 28_000,
      }),
    ).toBe("manual_daily");
  });
});
