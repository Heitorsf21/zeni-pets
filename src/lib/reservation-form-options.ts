export type ReservationServiceOption = {
  id: string;
  name: string;
  kind: string;
  priceRules: Array<{
    id: string;
    serviceTypeId: string;
    label: string;
    paymentMethod: string;
    firstPetCents: number;
    additionalPetCents: number | null;
    highSeasonFirstPetCents: number | null;
    highSeasonAdditionalCents: number | null;
    fixedFeeCents: number | null;
    perKmCents: number | null;
    hygieneFeeCents: number | null;
  }>;
};

export function toReservationServiceOptions(
  serviceTypes: Array<{
    id: string;
    name: string;
    kind: string;
    priceRules: ReservationServiceOption["priceRules"];
  }>,
): ReservationServiceOption[] {
  return serviceTypes.map((service) => ({
    id: service.id,
    name: service.name,
    kind: service.kind,
    priceRules: service.priceRules.map((rule) => ({
      id: rule.id,
      serviceTypeId: rule.serviceTypeId,
      label: rule.label,
      paymentMethod: rule.paymentMethod,
      firstPetCents: rule.firstPetCents,
      additionalPetCents: rule.additionalPetCents,
      highSeasonFirstPetCents: rule.highSeasonFirstPetCents,
      highSeasonAdditionalCents: rule.highSeasonAdditionalCents,
      fixedFeeCents: rule.fixedFeeCents,
      perKmCents: rule.perKmCents,
      hygieneFeeCents: rule.hygieneFeeCents,
    })),
  }));
}

export type ReservationSeasonOption = {
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

export function toReservationSeasonOptions(
  seasons: Array<{ startsAt: Date; endsAt: Date; isActive: boolean }>,
): ReservationSeasonOption[] {
  return seasons.map((season) => ({
    startsAt: season.startsAt.toISOString(),
    endsAt: season.endsAt.toISOString(),
    isActive: season.isActive,
  }));
}
