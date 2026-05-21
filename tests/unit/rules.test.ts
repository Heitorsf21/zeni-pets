import { describe, expect, it } from "vitest";
import {
  calculateChargeableStayUnits,
  calculateDepositPlan,
  calculateLateFeeCents,
  calculateReservationTotals,
  calculateTaxiPetCents,
  isHighSeason,
} from "@/lib/rules";

describe("reservation calculation rules", () => {
  it("calculates chargeable stay units from the reservation period", () => {
    expect(
      calculateChargeableStayUnits(
        new Date("2026-06-09T10:00:00-03:00"),
        new Date("2026-06-14T10:00:00-03:00"),
      ),
    ).toBe(5);

    expect(
      calculateChargeableStayUnits(
        new Date("2026-06-09T10:00:00-03:00"),
        new Date("2026-06-09T18:00:00-03:00"),
      ),
    ).toBe(1);
  });

  it("treats the boarding check-out date as the exclusive end for nights", () => {
    // User picks 22/06 to 24/06. Billing is 22->23 and 23->24: 2 nights.
    expect(
      calculateChargeableStayUnits(
        new Date(2026, 5, 22),
        new Date(2026, 5, 24),
      ),
    ).toBe(2);
  });

  it("treats a PET_SITTING visit as a single unit", () => {
    // Visit on 07/05: startsAt=07/05 00:00, endsAt=08/05 00:00.
    expect(
      calculateChargeableStayUnits(
        new Date(2026, 4, 7),
        new Date(2026, 4, 8),
      ),
    ).toBe(1);
  });

  it("suggests 50% deposit and balance by default", () => {
    expect(calculateDepositPlan(48_000)).toEqual({
      depositSuggestedCents: 24_000,
      depositDueCents: 24_000,
      balanceDueCents: 24_000,
    });
  });

  it("rounds started late hours up for one pet", () => {
    expect(
      calculateLateFeeCents({
        scheduledEnd: new Date("2026-04-27T18:00:00-03:00"),
        actualEnd: new Date("2026-04-27T19:01:00-03:00"),
        petCount: 1,
      }),
    ).toBe(2_000);
  });

  it("charges a total R$15/h late fee for two or more pets", () => {
    expect(
      calculateLateFeeCents({
        scheduledEnd: new Date("2026-04-27T18:00:00-03:00"),
        actualEnd: new Date("2026-04-27T18:10:00-03:00"),
        petCount: 2,
      }),
    ).toBe(1_500);
  });

  it("charges taxi pet only when Zeni picks up", () => {
    expect(
      calculateTaxiPetCents({
        pickupMode: "TUTOR_DROPS_OFF",
        fixedFeeCents: 2_000,
        distanceKm: 8,
        perKmCents: 400,
        hygieneFeeCents: 2_500,
      }),
    ).toBe(0);

    expect(
      calculateTaxiPetCents({
        pickupMode: "ZENI_PICKUP",
        fixedFeeCents: 2_000,
        distanceKm: 8,
        perKmCents: 400,
        hygieneFeeCents: 2_500,
      }),
    ).toBe(7_700);
  });

  it("detects high season windows", () => {
    expect(
      isHighSeason(new Date("2026-12-24T10:00:00-03:00"), [
        {
          startsAt: new Date("2026-12-15T00:00:00-03:00"),
          endsAt: new Date("2027-01-05T23:59:59-03:00"),
        },
      ]),
    ).toBe(true);
  });

  it("combines discounts, additions, taxi and late fee", () => {
    expect(
      calculateReservationTotals({
        baseAmountCents: 48_000,
        discountCents: 1_000,
        additionalCents: 2_000,
        taxiPetCents: 7_700,
        lateFeeCents: 1_500,
      }),
    ).toMatchObject({
      totalCents: 58_200,
      depositSuggestedCents: 29_100,
      balanceDueCents: 29_100,
    });
  });
});
