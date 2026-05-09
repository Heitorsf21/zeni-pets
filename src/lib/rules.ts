export type PickupMode = "TUTOR_DROPS_OFF" | "ZENI_PICKUP";

export type SeasonWindow = {
  startsAt: Date;
  endsAt: Date;
  isActive?: boolean;
};

export type ReservationTotalInput = {
  baseAmountCents: number;
  discountCents?: number;
  additionalCents?: number;
  taxiPetCents?: number;
  lateFeeCents?: number;
  depositPercent?: number;
};

export function calculateDepositPlan(totalCents: number, depositPercent = 50) {
  const depositSuggestedCents = Math.round((totalCents * depositPercent) / 100);
  return {
    depositSuggestedCents,
    depositDueCents: depositSuggestedCents,
    balanceDueCents: Math.max(totalCents - depositSuggestedCents, 0),
  };
}

export function calculateLateFeeCents(input: {
  scheduledEnd: Date;
  actualEnd: Date;
  petCount: number;
  onePetHourlyCents?: number;
  manyPetsHourlyCents?: number;
}) {
  const diffMs = input.actualEnd.getTime() - input.scheduledEnd.getTime();
  if (diffMs <= 0) return 0;

  const hoursStarted = Math.ceil(diffMs / (60 * 60 * 1000));
  const hourly =
    input.petCount <= 1
      ? input.onePetHourlyCents ?? 1000
      : input.manyPetsHourlyCents ?? 1500;

  return hoursStarted * hourly;
}

export function shouldChargeTaxiPet(pickupMode: PickupMode) {
  return pickupMode === "ZENI_PICKUP";
}

export function calculateTaxiPetCents(input: {
  pickupMode: PickupMode;
  fixedFeeCents: number;
  distanceKm?: number;
  perKmCents?: number;
  hygieneFeeCents?: number;
}) {
  if (!shouldChargeTaxiPet(input.pickupMode)) return 0;

  return (
    input.fixedFeeCents +
    Math.ceil(input.distanceKm ?? 0) * (input.perKmCents ?? 0) +
    (input.hygieneFeeCents ?? 0)
  );
}

export function isHighSeason(date: Date, periods: SeasonWindow[]) {
  const time = date.getTime();
  return periods.some((period) => {
    if (period.isActive === false) return false;
    return time >= period.startsAt.getTime() && time <= period.endsAt.getTime();
  });
}

export function calculateReservationTotals(input: ReservationTotalInput) {
  const totalCents = Math.max(
    input.baseAmountCents -
      (input.discountCents ?? 0) +
      (input.additionalCents ?? 0) +
      (input.taxiPetCents ?? 0) +
      (input.lateFeeCents ?? 0),
    0,
  );

  return {
    totalCents,
    ...calculateDepositPlan(totalCents, input.depositPercent ?? 50),
  };
}
