"use client";

import { useMemo, useState } from "react";
import { brl } from "@/lib/money";
import { selectDefaultPriceRule, sortPriceRules } from "@/lib/pricing";
import type { ReservationServiceOption } from "@/lib/reservation-form-options";

type PricingMode = "fixed" | "manual_daily" | "manual_total";

type Props = {
  serviceTypes: ReservationServiceOption[];
  lockServiceType?: boolean;
  defaultServiceTypeId?: string;
  defaultPricingMode?: PricingMode | "manual";
  defaultPriceRuleId?: string;
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

function normalizeMode(mode: Props["defaultPricingMode"]): PricingMode {
  if (mode === "manual") return "manual_daily";
  return mode ?? "fixed";
}

function resolveInitialService(
  serviceTypes: ReservationServiceOption[],
  defaultServiceTypeId?: string,
  defaultPriceRuleId?: string,
) {
  return (
    serviceTypes.find((service) => service.id === defaultServiceTypeId) ??
    serviceTypes.find((service) => service.priceRules.some((rule) => rule.id === defaultPriceRuleId)) ??
    serviceTypes[0] ??
    null
  );
}

export function ServicePriceRuleFields({
  serviceTypes,
  lockServiceType = false,
  defaultServiceTypeId,
  defaultPricingMode,
  defaultPriceRuleId,
}: Props) {
  const initialService = resolveInitialService(serviceTypes, defaultServiceTypeId, defaultPriceRuleId);
  const initialRule =
    initialService?.priceRules.find((rule) => rule.id === defaultPriceRuleId) ??
    (initialService ? selectDefaultPriceRule(initialService.priceRules) : null);
  const [serviceTypeId, setServiceTypeId] = useState(initialService?.id ?? "");
  const [priceRuleId, setPriceRuleId] = useState(initialRule?.id ?? "");
  const [pricingMode, setPricingMode] = useState<PricingMode>(normalizeMode(defaultPricingMode));

  const selectedService = useMemo(
    () => serviceTypes.find((service) => service.id === serviceTypeId) ?? initialService,
    [initialService, serviceTypeId, serviceTypes],
  );
  const rules = useMemo(
    () => sortPriceRules(selectedService?.priceRules ?? []),
    [selectedService?.priceRules],
  );
  const selectedRule = rules.find((rule) => rule.id === priceRuleId) ?? selectDefaultPriceRule(rules);

  return (
    <>
      <input type="hidden" name="pricingMode" value={pricingMode} />

      {!lockServiceType ? (
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
      ) : null}

      <fieldset
        className="field"
        style={{
          border: 0,
          margin: 0,
          padding: 0,
          gridColumn: "1 / -1",
        }}
      >
        <legend className="field__label">Como cobrar</legend>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <label className="check">
            <input
              type="radio"
              name="pricingMode__radio"
              value="fixed"
              checked={pricingMode === "fixed"}
              onChange={() => setPricingMode("fixed")}
            />
            Valor da tabela
          </label>
          <label className="check">
            <input
              type="radio"
              name="pricingMode__radio"
              value="manual_daily"
              checked={pricingMode === "manual_daily"}
              onChange={() => setPricingMode("manual_daily")}
            />
            Valor manual por diária
          </label>
          <label className="check">
            <input
              type="radio"
              name="pricingMode__radio"
              value="manual_total"
              checked={pricingMode === "manual_total"}
              onChange={() => setPricingMode("manual_total")}
            />
            Valor total manual
          </label>
        </div>
      </fieldset>

      {pricingMode === "fixed" ? (
        <label className="field">
          <span className="field__label">Tabela de preço</span>
          <select
            className="select"
            name="priceRuleId"
            required
            value={selectedRule?.id ?? ""}
            onChange={(event) => setPriceRuleId(event.target.value)}
          >
            {rules.length === 0 ? (
              <option value="">Sem tabela cadastrada</option>
            ) : (
              rules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {ruleLabel(rule)}
                </option>
              ))
            )}
          </select>
        </label>
      ) : null}
    </>
  );
}
