export type ReservationStatus = "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";

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

export function deriveReservationStatus(input: DeriveStatusInput): DeriveStatusOutput {
  const paymentStatus = derivePaymentStatus(input.paidCents, input.totalCents);

  if (input.cancelled || input.currentStatus === "CANCELLED") {
    return { status: "CANCELLED", paymentStatus };
  }

  const now = input.now.getTime();
  const start = input.startsAt.getTime();
  const end = input.endsAt.getTime();

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
