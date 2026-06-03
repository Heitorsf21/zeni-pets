import { businessDateParts } from "@/lib/date";

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

const DAY_MS = 86_400_000;

function businessDaySerial(date: Date) {
  const parts = businessDateParts(date);
  return Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS;
}

export function calculateChargeableStayUnits(startsAt: Date, endsAt: Date) {
  const diffMs = endsAt.getTime() - startsAt.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.max(businessDaySerial(endsAt) - businessDaySerial(startsAt), 1);
}

export type ReservationDailyUnitsInput = {
  kind?: string | null;
  startsAt: Date;
  endsAt: Date;
  visitDates?: Date[];
};

export function calculateDailyUnitsForKind(input: ReservationDailyUnitsInput) {
  if (input.kind === "PET_SITTING") {
    return input.visitDates?.length ?? 0;
  }
  if (input.kind === "DAYCARE") {
    return 1;
  }
  return calculateChargeableStayUnits(input.startsAt, input.endsAt);
}

export function countHighSeasonUnitsFromDates(dates: Date[], periods: SeasonWindow[]) {
  if (!dates.length || !periods.length) return 0;
  return dates.filter((date) => isHighSeason(date, periods)).length;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

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
  const time = startOfLocalDay(date).getTime();
  return periods.some((period) => {
    if (period.isActive === false) return false;
    return time >= startOfLocalDay(period.startsAt).getTime() && time <= startOfLocalDay(period.endsAt).getTime();
  });
}

export function countHighSeasonStayUnits(startsAt: Date, endsAt: Date, periods: SeasonWindow[]) {
  const units = calculateChargeableStayUnits(startsAt, endsAt);
  if (!units || !periods.length) return 0;

  const firstDay = startOfLocalDay(startsAt);
  let highSeasonUnits = 0;

  for (let index = 0; index < units; index++) {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + index);
    if (isHighSeason(day, periods)) highSeasonUnits++;
  }

  return highSeasonUnits;
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
