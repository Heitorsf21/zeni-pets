export type ReservationPricingMode = "fixed" | "manual_daily" | "manual_total";

export function normalizeReservationPricingMode(mode: string | null | undefined): ReservationPricingMode {
  if (mode === "manual") return "manual_daily";
  if (mode === "manual_daily" || mode === "manual_total") return mode;
  return "fixed";
}

export function inferReservationEditPricingMode(input: {
  persistedMode: string | null | undefined;
  savedBaseAmountCents: number;
  recalculatedFixedBaseCents: number | null;
}): ReservationPricingMode {
  const mode = normalizeReservationPricingMode(input.persistedMode);
  if (mode !== "fixed") return mode;

  if (input.recalculatedFixedBaseCents == null) {
    return input.savedBaseAmountCents > 0 ? "manual_total" : "fixed";
  }

  return input.savedBaseAmountCents !== input.recalculatedFixedBaseCents
    ? "manual_total"
    : "fixed";
}
