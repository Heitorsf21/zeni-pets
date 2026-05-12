import { describe, expect, it } from "vitest";
import {
  deriveInitialReservationStatus,
  derivePaymentStatus,
  deriveReservationStatus,
  shouldAutoStartReservation,
  sumPaidCents,
} from "@/lib/reservation-status";

const NOW = new Date("2026-05-09T12:00:00.000Z");

function days(offset: number): Date {
  return new Date(NOW.getTime() + offset * 86_400_000);
}

describe("derivePaymentStatus", () => {
  it("returns PAID when paid >= total", () => {
    expect(derivePaymentStatus(10000, 10000)).toBe("PAID");
    expect(derivePaymentStatus(15000, 10000)).toBe("PAID");
  });

  it("returns PARTIAL when paid > 0 but < total", () => {
    expect(derivePaymentStatus(5000, 10000)).toBe("PARTIAL");
  });

  it("returns PENDING when paid === 0", () => {
    expect(derivePaymentStatus(0, 10000)).toBe("PENDING");
  });

  it("treats total <= 0 as paid when any cents come in", () => {
    expect(derivePaymentStatus(0, 0)).toBe("PENDING");
    expect(derivePaymentStatus(100, 0)).toBe("PAID");
  });
});

describe("sumPaidCents", () => {
  it("sums only PAID payments", () => {
    expect(
      sumPaidCents([
        { status: "PAID", amountCents: 1000 },
        { status: "PENDING", amountCents: 500 },
        { status: "PAID", amountCents: 2000 },
        { status: "CANCELLED", amountCents: 999 },
      ]),
    ).toBe(3000);
  });
});

describe("deriveReservationStatus — future reservations", () => {
  it("preserves REQUESTED for future date", () => {
    const out = deriveReservationStatus({
      now: NOW,
      startsAt: days(3),
      endsAt: days(5),
      currentStatus: "REQUESTED",
      paidCents: 0,
      totalCents: 10000,
    });
    expect(out.status).toBe("REQUESTED");
    expect(out.paymentStatus).toBe("PENDING");
  });

  it("preserves CONFIRMED for future date", () => {
    const out = deriveReservationStatus({
      now: NOW,
      startsAt: days(3),
      endsAt: days(5),
      currentStatus: "CONFIRMED",
      paidCents: 10000,
      totalCents: 10000,
    });
    expect(out.status).toBe("CONFIRMED");
    expect(out.paymentStatus).toBe("PAID");
  });

  it("downgrades anomalous COMPLETED future to CONFIRMED (importer bug)", () => {
    const out = deriveReservationStatus({
      now: NOW,
      startsAt: days(10),
      endsAt: days(12),
      currentStatus: "COMPLETED",
      paidCents: 10000,
      totalCents: 10000,
    });
    expect(out.status).toBe("CONFIRMED");
  });

  it("never reports IN_PROGRESS for a future date", () => {
    const out = deriveReservationStatus({
      now: NOW,
      startsAt: days(2),
      endsAt: days(4),
      currentStatus: "IN_PROGRESS",
      paidCents: 0,
      totalCents: 10000,
    });
    expect(out.status).toBe("CONFIRMED");
  });
});

describe("deriveReservationStatus — in progress", () => {
  it("returns IN_PROGRESS when now is between start and end", () => {
    const out = deriveReservationStatus({
      now: NOW,
      startsAt: days(-1),
      endsAt: days(2),
      currentStatus: "CONFIRMED",
      paidCents: 5000,
      totalCents: 10000,
    });
    expect(out.status).toBe("IN_PROGRESS");
    expect(out.paymentStatus).toBe("PARTIAL");
  });

  it("auto-progresses REQUESTED into IN_PROGRESS when start passed", () => {
    const out = deriveReservationStatus({
      now: NOW,
      startsAt: days(-1),
      endsAt: days(1),
      currentStatus: "REQUESTED",
      paidCents: 0,
      totalCents: 10000,
    });
    expect(out.status).toBe("IN_PROGRESS");
    expect(out.paymentStatus).toBe("PENDING");
  });
});

describe("deriveReservationStatus — past", () => {
  it("returns COMPLETED when hasActualEnd is true", () => {
    const out = deriveReservationStatus({
      now: NOW,
      startsAt: days(-5),
      endsAt: days(-2),
      currentStatus: "CONFIRMED",
      paidCents: 10000,
      totalCents: 10000,
      hasActualEnd: true,
    });
    expect(out.status).toBe("COMPLETED");
    expect(out.paymentStatus).toBe("PAID");
  });

  it("returns COMPLETED when current status is already IN_PROGRESS or COMPLETED", () => {
    const fromInProgress = deriveReservationStatus({
      now: NOW,
      startsAt: days(-5),
      endsAt: days(-2),
      currentStatus: "IN_PROGRESS",
      paidCents: 5000,
      totalCents: 10000,
    });
    expect(fromInProgress.status).toBe("COMPLETED");
    expect(fromInProgress.paymentStatus).toBe("PARTIAL");

    const fromCompleted = deriveReservationStatus({
      now: NOW,
      startsAt: days(-5),
      endsAt: days(-2),
      currentStatus: "COMPLETED",
      paidCents: 0,
      totalCents: 10000,
    });
    expect(fromCompleted.status).toBe("COMPLETED");
    expect(fromCompleted.paymentStatus).toBe("PENDING");
  });

  it("keeps IN_PROGRESS for stale CONFIRMED past without actual end", () => {
    const out = deriveReservationStatus({
      now: NOW,
      startsAt: days(-5),
      endsAt: days(-2),
      currentStatus: "CONFIRMED",
      paidCents: 0,
      totalCents: 10000,
    });
    expect(out.status).toBe("IN_PROGRESS");
  });
});

describe("deriveReservationStatus — cancelled", () => {
  it("returns CANCELLED when currentStatus is CANCELLED", () => {
    const out = deriveReservationStatus({
      now: NOW,
      startsAt: days(-1),
      endsAt: days(1),
      currentStatus: "CANCELLED",
      paidCents: 0,
      totalCents: 10000,
    });
    expect(out.status).toBe("CANCELLED");
  });

  it("returns CANCELLED when cancelled flag is true", () => {
    const out = deriveReservationStatus({
      now: NOW,
      startsAt: days(3),
      endsAt: days(5),
      currentStatus: "CONFIRMED",
      paidCents: 0,
      totalCents: 10000,
      cancelled: true,
    });
    expect(out.status).toBe("CANCELLED");
  });
});

describe("automatic reservation lifecycle", () => {
  it("auto-starts requested or confirmed reservations inside their period", () => {
    expect(
      shouldAutoStartReservation({
        now: NOW,
        startsAt: days(-2),
        endsAt: days(3),
        currentStatus: "CONFIRMED",
      }),
    ).toBe(true);

    expect(
      shouldAutoStartReservation({
        now: NOW,
        startsAt: days(-2),
        endsAt: days(3),
        currentStatus: "REQUESTED",
      }),
    ).toBe(true);
  });

  it("does not auto-start future, finished, completed or cancelled reservations", () => {
    expect(
      shouldAutoStartReservation({
        now: NOW,
        startsAt: days(1),
        endsAt: days(3),
        currentStatus: "CONFIRMED",
      }),
    ).toBe(false);

    expect(
      shouldAutoStartReservation({
        now: NOW,
        startsAt: days(-3),
        endsAt: days(-1),
        currentStatus: "CONFIRMED",
      }),
    ).toBe(false);

    expect(
      shouldAutoStartReservation({
        now: NOW,
        startsAt: days(-1),
        endsAt: days(1),
        currentStatus: "COMPLETED",
      }),
    ).toBe(false);

    expect(
      shouldAutoStartReservation({
        now: NOW,
        startsAt: days(-1),
        endsAt: days(1),
        currentStatus: "CANCELLED",
      }),
    ).toBe(false);
  });

  it("creates a reservation already in progress when start has passed", () => {
    expect(
      deriveInitialReservationStatus({
        now: NOW,
        startsAt: days(-2),
        endsAt: days(3),
      }),
    ).toBe("IN_PROGRESS");

    expect(
      deriveInitialReservationStatus({
        now: NOW,
        startsAt: days(2),
        endsAt: days(3),
      }),
    ).toBe("CONFIRMED");
  });
});
