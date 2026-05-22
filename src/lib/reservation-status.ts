import { getPrisma } from "@/lib/db";
import { normalizeDateOnlyBoundary } from "@/lib/date";

export type ReservationStatus = "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";

const AUTO_START_STATUSES: ReservationStatus[] = ["REQUESTED", "CONFIRMED"];

export type DeriveStatusInput = {
  now: Date;
  startsAt: Date;
  endsAt: Date;
  currentStatus: ReservationStatus;
  paidCents: number;
  totalCents: number;
  hasActualEnd?: boolean;
  cancelled?: boolean;
};

export type DeriveStatusOutput = {
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
};

export function shouldAutoStartReservation(input: {
  now: Date;
  startsAt: Date;
  endsAt: Date;
  currentStatus: ReservationStatus;
}) {
  const startsAt = normalizeDateOnlyBoundary(input.startsAt);
  const endsAt = normalizeDateOnlyBoundary(input.endsAt);

  return (
    AUTO_START_STATUSES.includes(input.currentStatus) &&
    startsAt.getTime() <= input.now.getTime() &&
    endsAt.getTime() > input.now.getTime()
  );
}

export function deriveInitialReservationStatus(input: {
  startsAt: Date;
  endsAt: Date;
  now?: Date;
  fallbackStatus?: Extract<ReservationStatus, "REQUESTED" | "CONFIRMED">;
}): Extract<ReservationStatus, "CONFIRMED" | "IN_PROGRESS"> {
  const now = input.now ?? new Date();
  const fallbackStatus = input.fallbackStatus ?? "CONFIRMED";
  return shouldAutoStartReservation({
    now,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    currentStatus: fallbackStatus,
  })
    ? "IN_PROGRESS"
    : "CONFIRMED";
}

export async function refreshReservationLifecycleStatuses(now = new Date()) {
  const candidates = await getPrisma().reservation.findMany({
    where: {
      status: { in: AUTO_START_STATUSES },
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    select: { id: true, status: true, startsAt: true, endsAt: true },
  });
  const ids = candidates
    .filter((reservation) =>
      shouldAutoStartReservation({
        now,
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        currentStatus: reservation.status as ReservationStatus,
      }),
    )
    .map((reservation) => reservation.id);

  if (!ids.length) return { count: 0 };

  return getPrisma().reservation.updateMany({
    where: { id: { in: ids } },
    data: { status: "IN_PROGRESS" },
  });
}

export function deriveReservationStatus(input: DeriveStatusInput): DeriveStatusOutput {
  const paymentStatus = derivePaymentStatus(input.paidCents, input.totalCents);

  if (input.cancelled || input.currentStatus === "CANCELLED") {
    return { status: "CANCELLED", paymentStatus };
  }

  const now = input.now.getTime();
  const start = normalizeDateOnlyBoundary(input.startsAt).getTime();
  const end = normalizeDateOnlyBoundary(input.endsAt).getTime();

  if (now < start) {
    if (input.currentStatus === "REQUESTED") return { status: "REQUESTED", paymentStatus };
    return { status: "CONFIRMED", paymentStatus };
  }

  if (now < end) {
    return { status: "IN_PROGRESS", paymentStatus };
  }

  if (input.hasActualEnd || input.currentStatus === "COMPLETED" || input.currentStatus === "IN_PROGRESS") {
    return { status: "COMPLETED", paymentStatus };
  }
  return { status: "IN_PROGRESS", paymentStatus };
}

export function derivePaymentStatus(paidCents: number, totalCents: number): PaymentStatus {
  const paid = Math.max(paidCents, 0);
  const total = Math.max(totalCents, 0);
  if (total <= 0) {
    return paid > 0 ? "PAID" : "PENDING";
  }
  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "PENDING";
}

export function sumPaidCents(payments: ReadonlyArray<{ status: PaymentStatus; amountCents: number }>): number {
  return payments.reduce((total, p) => (p.status === "PAID" ? total + p.amountCents : total), 0);
}
