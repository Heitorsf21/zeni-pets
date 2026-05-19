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

type ServiceSnapshot = {
  serviceType: {
    id: string;
    name: string;
    kind: string;
  } | null;
  priceRule?: ReservationServiceOption["priceRules"][number] | null;
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

export function withReservationServiceSnapshots(
  serviceTypes: ReservationServiceOption[],
  snapshots: ServiceSnapshot[],
): ReservationServiceOption[] {
  const byId = new Map(
    serviceTypes.map((service) => [
      service.id,
      { ...service, priceRules: [...service.priceRules] },
    ]),
  );

  for (const snapshot of snapshots) {
    if (!snapshot.serviceType) continue;

    const service =
      byId.get(snapshot.serviceType.id) ??
      {
        id: snapshot.serviceType.id,
        name: snapshot.serviceType.name,
        kind: snapshot.serviceType.kind,
        priceRules: [],
      };

    if (
      snapshot.priceRule &&
      !service.priceRules.some((rule) => rule.id === snapshot.priceRule?.id)
    ) {
      service.priceRules.push({
        id: snapshot.priceRule.id,
        serviceTypeId: snapshot.priceRule.serviceTypeId,
        label: snapshot.priceRule.label,
        paymentMethod: snapshot.priceRule.paymentMethod,
        firstPetCents: snapshot.priceRule.firstPetCents,
        additionalPetCents: snapshot.priceRule.additionalPetCents,
        highSeasonFirstPetCents: snapshot.priceRule.highSeasonFirstPetCents,
        highSeasonAdditionalCents: snapshot.priceRule.highSeasonAdditionalCents,
        fixedFeeCents: snapshot.priceRule.fixedFeeCents,
        perKmCents: snapshot.priceRule.perKmCents,
        hygieneFeeCents: snapshot.priceRule.hygieneFeeCents,
      });
    }

    byId.set(service.id, service);
  }

  return Array.from(byId.values());
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
