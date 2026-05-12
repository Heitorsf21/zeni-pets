import { describe, expect, it } from "vitest";
import {
  calculatePriceRuleBaseCents,
  selectDefaultPriceRule,
  selectDefaultTaxiRule,
  sortPriceRules,
} from "@/lib/pricing";

const rules = [
  {
    id: "card",
    serviceTypeId: "service",
    label: "1 pet",
    paymentMethod: "CARD",
    firstPetCents: 8700,
    additionalPetCents: 6520,
    highSeasonFirstPetCents: null,
    highSeasonAdditionalCents: null,
  },
  {
    id: "pix",
    serviceTypeId: "service",
    label: "1 pet",
    paymentMethod: "PIX",
    firstPetCents: 8000,
    additionalPetCents: 6000,
    highSeasonFirstPetCents: 9500,
    highSeasonAdditionalCents: 7000,
  },
];

describe("pricing helpers", () => {
  it("prefers PIX as the default reservation price rule", () => {
    expect(selectDefaultPriceRule(rules)?.id).toBe("pix");
    expect(sortPriceRules(rules).map((rule) => rule.id)).toEqual(["pix", "card"]);
  });

  it("calculates first pet, additional pets, and high season overrides", () => {
    expect(calculatePriceRuleBaseCents(rules[1], 1, false)).toBe(8000);
    expect(calculatePriceRuleBaseCents(rules[1], 3, false)).toBe(20000);
    expect(calculatePriceRuleBaseCents(rules[1], 3, true)).toBe(23500);
  });

  it("multiplies the selected rule by the chargeable stay units", () => {
    expect(calculatePriceRuleBaseCents(rules[1], 1, false, 5)).toBe(40000);
    expect(calculatePriceRuleBaseCents(rules[1], 2, false, 5)).toBe(70000);
  });

  it("uses the configured Taxi Pet transport rule when the stay rule has no km price", () => {
    const taxiRule = selectDefaultTaxiRule([
      {
        id: "daycare",
        name: "Creche",
        kind: "DAYCARE",
        priceRules: rules,
      },
      {
        id: "visits",
        name: "Deslocamento p/ Visitas",
        kind: "TAXI_PET",
        priceRules: [
          {
            id: "visit-taxi",
            serviceTypeId: "visits",
            label: "Taxi",
            paymentMethod: "PIX",
            firstPetCents: 0,
            fixedFeeCents: 1500,
            perKmCents: 350,
            hygieneFeeCents: null,
          },
        ],
      },
      {
        id: "transport",
        name: "Taxi Pet (Transporte)",
        kind: "TAXI_PET",
        priceRules: [
          {
            id: "transport-taxi",
            serviceTypeId: "transport",
            label: "Taxi",
            paymentMethod: "PIX",
            firstPetCents: 0,
            fixedFeeCents: 2000,
            perKmCents: 400,
            hygieneFeeCents: 2500,
          },
        ],
      },
    ]);

    expect(taxiRule?.id).toBe("transport-taxi");
  });
});
