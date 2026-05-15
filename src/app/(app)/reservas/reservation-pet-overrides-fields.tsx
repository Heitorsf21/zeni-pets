"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { brl } from "@/lib/money";
import { selectDefaultPriceRule, sortPriceRules } from "@/lib/pricing";
import type { ReservationServiceOption } from "@/lib/reservation-form-options";

type PetOption = { id: string; name: string; tutor: { id: string; name: string } };

type PricingMode = "fixed" | "manual_daily" | "manual_total";

type Props = {
  pets: PetOption[];
  serviceTypes: ReservationServiceOption[];
  formId?: string;
};

type OverrideState = {
  enabled: boolean;
  serviceTypeId: string;
  priceRuleId: string;
  pricingMode: PricingMode;
  manualDailyAmount: string;
  manualTotalAmount: string;
};

function blankOverride(serviceTypes: ReservationServiceOption[]): OverrideState {
  const first = serviceTypes[0] ?? null;
  const rule = first ? selectDefaultPriceRule(first.priceRules) : null;
  return {
    enabled: false,
    serviceTypeId: first?.id ?? "",
    priceRuleId: rule?.id ?? "",
    pricingMode: "fixed",
    manualDailyAmount: "",
    manualTotalAmount: "",
  };
}

function ruleLabel(rule: ReservationServiceOption["priceRules"][number]) {
  return [rule.label, rule.paymentMethod, brl(rule.firstPetCents)].filter(Boolean).join(" - ");
}

export function ReservationPetOverridesFields({ pets, serviceTypes, formId }: Props) {
  const pivotRef = useRef<HTMLSpanElement>(null);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, OverrideState>>({});

  useEffect(() => {
    const form = formId
      ? document.getElementById(formId)
      : pivotRef.current?.closest("form");
    if (!(form instanceof HTMLFormElement)) return;

    const sync = () => {
      const data = new FormData(form);
      const ids = data.getAll("petIds").map(String).filter(Boolean);
      setSelectedPetIds((current) => {
        if (current.length === ids.length && current.every((id, index) => id === ids[index])) {
          return current;
        }
        return ids;
      });
    };
    sync();
    form.addEventListener("change", sync);
    form.addEventListener("input", sync);
    return () => {
      form.removeEventListener("change", sync);
      form.removeEventListener("input", sync);
    };
  }, [formId]);

  const petsById = useMemo(() => new Map(pets.map((pet) => [pet.id, pet])), [pets]);

  function getOverride(petId: string): OverrideState {
    return overrides[petId] ?? blankOverride(serviceTypes);
  }

  function setOverride(petId: string, patch: Partial<OverrideState>) {
    setOverrides((current) => ({
      ...current,
      [petId]: { ...(current[petId] ?? blankOverride(serviceTypes)), ...patch },
    }));
  }

  const visiblePets = selectedPetIds
    .map((id) => petsById.get(id))
    .filter((pet): pet is PetOption => Boolean(pet));

  return (
    <>
      <span ref={pivotRef} aria-hidden style={{ display: "none" }} />
      {visiblePets.length < 2 ? null : (
      <fieldset
        className="field"
        style={{ border: 0, margin: 0, padding: 0, gridColumn: "1 / -1" }}
      >
      <legend className="field__label">Configuração por pet (opcional)</legend>
      <p className="subtle" style={{ margin: "0 0 8px", fontSize: 11 }}>
        Marque para sobrescrever o serviço ou o valor de um pet específico. Caso contrário, todos seguem a configuração principal da reserva.
      </p>
      <div className="stack" style={{ gap: 8 }}>
        {visiblePets.map((pet) => {
          const state = getOverride(pet.id);
          const service = serviceTypes.find((s) => s.id === state.serviceTypeId) ?? serviceTypes[0] ?? null;
          const rules = sortPriceRules(service?.priceRules ?? []);
          return (
            <div
              key={pet.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 10,
                background: "var(--bg-elevated)",
              }}
            >
              <button
                type="button"
                onClick={() => setOverride(pet.id, { enabled: !state.enabled })}
                aria-expanded={state.enabled}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  padding: 0,
                  color: "var(--text)",
                  fontSize: 13,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {state.enabled ? (
                    <ChevronDown style={{ width: 14, height: 14 }} />
                  ) : (
                    <ChevronRight style={{ width: 14, height: 14 }} />
                  )}
                  <strong>{pet.name}</strong>
                </span>
                <span className="subtle" style={{ fontSize: 11 }}>
                  {state.enabled ? "Personalizado" : "Clique para personalizar"}
                </span>
              </button>

              {state.enabled ? (
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <input
                    type="hidden"
                    name={`petOverride.${pet.id}.serviceTypeId`}
                    value={state.serviceTypeId}
                  />
                  <input
                    type="hidden"
                    name={`petOverride.${pet.id}.priceRuleId`}
                    value={state.pricingMode === "fixed" ? state.priceRuleId : ""}
                  />
                  <input
                    type="hidden"
                    name={`petOverride.${pet.id}.pricingMode`}
                    value={state.pricingMode}
                  />

                  <label className="field">
                    <span className="field__label">Serviço</span>
                    <select
                      className="select"
                      value={state.serviceTypeId}
                      onChange={(event) => {
                        const next = serviceTypes.find((s) => s.id === event.target.value) ?? null;
                        const nextRule = next ? selectDefaultPriceRule(next.priceRules) : null;
                        setOverride(pet.id, {
                          serviceTypeId: next?.id ?? "",
                          priceRuleId: nextRule?.id ?? "",
                        });
                      }}
                    >
                      {serviceTypes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <fieldset
                    className="field"
                    style={{ border: 0, margin: 0, padding: 0, gridColumn: "1 / -1" }}
                  >
                    <legend className="field__label">Como cobrar este pet</legend>
                    <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                      {(["fixed", "manual_daily", "manual_total"] as const).map((mode) => (
                        <label key={mode} className="check">
                          <input
                            type="radio"
                            name={`petOverride.${pet.id}.pricingMode__radio`}
                            checked={state.pricingMode === mode}
                            onChange={() => setOverride(pet.id, { pricingMode: mode })}
                          />
                          {mode === "fixed"
                            ? "Tabela"
                            : mode === "manual_daily"
                              ? "Manual por diária"
                              : "Total manual"}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {state.pricingMode === "fixed" ? (
                    <label className="field">
                      <span className="field__label">Tabela</span>
                      <select
                        className="select"
                        value={state.priceRuleId}
                        onChange={(event) => setOverride(pet.id, { priceRuleId: event.target.value })}
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

                  {state.pricingMode === "manual_daily" ? (
                    <label className="field">
                      <span className="field__label">Valor por diária</span>
                      <input
                        className="input"
                        name={`petOverride.${pet.id}.manualDailyCents`}
                        placeholder="0,00"
                        value={state.manualDailyAmount}
                        onChange={(event) =>
                          setOverride(pet.id, { manualDailyAmount: event.target.value })
                        }
                      />
                    </label>
                  ) : null}

                  {state.pricingMode === "manual_total" ? (
                    <label className="field">
                      <span className="field__label">Valor total</span>
                      <input
                        className="input"
                        name={`petOverride.${pet.id}.manualTotalCents`}
                        placeholder="0,00"
                        value={state.manualTotalAmount}
                        onChange={(event) =>
                          setOverride(pet.id, { manualTotalAmount: event.target.value })
                        }
                      />
                    </label>
                  ) : null}

                  <input type="hidden" name={`petOverride.${pet.id}.enabled`} value="1" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      </fieldset>
      )}
    </>
  );
}
