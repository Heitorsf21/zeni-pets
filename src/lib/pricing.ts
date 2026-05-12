export const DEFAULT_PRICING_PAYMENT_METHOD = "PIX";

export type PriceRuleLike = {
  id: string;
  serviceTypeId: string;
  label: string;
  paymentMethod: string;
  firstPetCents: number;
  additionalPetCents?: number | null;
  highSeasonFirstPetCents?: number | null;
  highSeasonAdditionalCents?: number | null;
  fixedFeeCents?: number | null;
  perKmCents?: number | null;
  hygieneFeeCents?: number | null;
};

export function calculatePriceRuleUnitCents(
  rule: PriceRuleLike,
  petCount: number,
  highSeason: boolean,
) {
  if (petCount <= 0) return 0;

  const firstPet = highSeason
    ? rule.highSeasonFirstPetCents ?? rule.firstPetCents
    : rule.firstPetCents;
  const additionalPet = highSeason
    ? rule.highSeasonAdditionalCents ?? rule.additionalPetCents ?? 0
    : rule.additionalPetCents ?? 0;

  return firstPet + Math.max(petCount - 1, 0) * additionalPet;
}

export function calculatePriceRuleBaseCents(
  rule: PriceRuleLike,
  petCount: number,
  highSeason: boolean,
  chargeableUnits = 1,
) {
  return calculatePriceRuleUnitCents(rule, petCount, highSeason) * Math.max(chargeableUnits, 1);
}

export function hasTaxiPricing(rule: PriceRuleLike | null | undefined) {
  return Boolean(
    (rule?.fixedFeeCents ?? 0) > 0 ||
      (rule?.perKmCents ?? 0) > 0 ||
      (rule?.hygieneFeeCents ?? 0) > 0,
  );
}

function normalizedText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function taxiServiceScore(service: { name: string; kind: string }) {
  const name = normalizedText(service.name);
  let score = service.kind === "TAXI_PET" ? 100 : 0;

  if (name.includes("taxi pet")) score += 40;
  else if (name.includes("taxi")) score += 25;

  if (name.includes("transporte")) score += 20;
  if (name.includes("principal") || name.includes("padrao")) score += 10;
  if (name.includes("visita") || name.includes("desloc")) score -= 15;

  return score;
}

export function selectDefaultTaxiRule<T extends PriceRuleLike>(
  serviceTypes: Array<{ id: string; name: string; kind: string; priceRules: T[] }>,
  preferredPaymentMethod = DEFAULT_PRICING_PAYMENT_METHOD,
) {
  const candidates = serviceTypes
    .filter((service) => service.kind === "TAXI_PET" || normalizedText(service.name).includes("taxi"))
    .flatMap((service) =>
      service.priceRules
        .filter(hasTaxiPricing)
        .map((rule) => ({
          service,
          rule,
          score:
            taxiServiceScore(service) +
            (rule.paymentMethod === preferredPaymentMethod ? 8 : 0) +
            ((rule.perKmCents ?? 0) > 0 ? 4 : 0) +
            ((rule.fixedFeeCents ?? 0) > 0 ? 2 : 0) +
            ((rule.hygieneFeeCents ?? 0) > 0 ? 1 : 0),
        })),
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return `${a.service.name}-${a.rule.label}`.localeCompare(`${b.service.name}-${b.rule.label}`);
    });

  return candidates[0]?.rule ?? null;
}

export function sortPriceRules<T extends PriceRuleLike>(rules: T[]) {
  return [...rules].sort((a, b) => {
    if (a.paymentMethod === DEFAULT_PRICING_PAYMENT_METHOD && b.paymentMethod !== DEFAULT_PRICING_PAYMENT_METHOD) {
      return -1;
    }
    if (b.paymentMethod === DEFAULT_PRICING_PAYMENT_METHOD && a.paymentMethod !== DEFAULT_PRICING_PAYMENT_METHOD) {
      return 1;
    }
    return `${a.label}-${a.paymentMethod}`.localeCompare(`${b.label}-${b.paymentMethod}`);
  });
}

export function selectDefaultPriceRule<T extends PriceRuleLike>(
  rules: T[],
  preferredPaymentMethod = DEFAULT_PRICING_PAYMENT_METHOD,
) {
  const sorted = sortPriceRules(rules);
  return sorted.find((rule) => rule.paymentMethod === preferredPaymentMethod) ?? sorted[0] ?? null;
}
