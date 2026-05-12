"use client";

import { useMemo, useState } from "react";
import { brl } from "@/lib/money";
import { selectDefaultPriceRule, sortPriceRules } from "@/lib/pricing";
import type { ReservationServiceOption } from "@/lib/reservation-form-options";

type Props = {
  serviceTypes: ReservationServiceOption[];
};

function ruleLabel(rule: ReservationServiceOption["priceRules"][number]) {
  const parts = [
    rule.label,
    rule.paymentMethod,
    brl(rule.firstPetCents),
    rule.additionalPetCents ? `+ ${brl(rule.additionalPetCents)}` : null,
  ].filter(Boolean);
  return parts.join(" - ");
}

export function ServicePriceRuleFields({ serviceTypes }: Props) {
  const firstService = serviceTypes[0] ?? null;
  const firstRule = firstService ? selectDefaultPriceRule(firstService.priceRules) : null;
  const [serviceTypeId, setServiceTypeId] = useState(firstService?.id ?? "");
  const [priceRuleId, setPriceRuleId] = useState(firstRule?.id ?? "");

  const selectedService = useMemo(
    () => serviceTypes.find((service) => service.id === serviceTypeId) ?? firstService,
    [firstService, serviceTypeId, serviceTypes],
  );
  const rules = useMemo(
    () => sortPriceRules(selectedService?.priceRules ?? []),
    [selectedService?.priceRules],
  );
  const selectedRule = rules.find((rule) => rule.id === priceRuleId) ?? rules[0] ?? null;

  return (
    <>
      <label className="field">
        <span className="field__label">Serviço</span>
        <select
          className="select"
          name="serviceTypeId"
          required
          value={selectedService?.id ?? ""}
          onChange={(event) => {
            const nextService = serviceTypes.find((service) => service.id === event.target.value) ?? null;
            const nextRule = nextService ? selectDefaultPriceRule(nextService.priceRules) : null;
            setServiceTypeId(nextService?.id ?? "");
            setPriceRuleId(nextRule?.id ?? "");
          }}
        >
          {serviceTypes.map((serviceType) => (
            <option key={serviceType.id} value={serviceType.id}>
              {serviceType.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">Tabela de preço</span>
        <select
          className="select"
          name="priceRuleId"
          required
          value={selectedRule?.id ?? ""}
          onChange={(event) => setPriceRuleId(event.target.value)}
        >
          {rules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {ruleLabel(rule)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
