"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brl, parseCurrencyToCents } from "@/lib/money";
import {
  calculatePriceRuleBaseCents,
  calculatePriceRuleUnitCents,
  hasTaxiPricing,
  selectDefaultPriceRule,
  selectDefaultTaxiRule,
  sortPriceRules,
} from "@/lib/pricing";
import type { ReservationSeasonOption, ReservationServiceOption } from "@/lib/reservation-form-options";
import {
  calculateChargeableStayUnits,
  calculateReservationTotals,
  calculateTaxiPetCents,
  isHighSeason,
} from "@/lib/rules";

type Props = {
  serviceTypes: ReservationServiceOption[];
  seasonPeriods?: ReservationSeasonOption[];
  depositPercent?: number;
  formId?: string;
  compact?: boolean;
};

function parseLocalDate(value: FormDataEntryValue | null) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDistanceKm(value: FormDataEntryValue | null) {
  if (!value) return 0;
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function centsFromForm(formData: FormData, key: string) {
  return parseCurrencyToCents(formData.get(key)) ?? 0;
}

export function ReservationPricingPreview({
  serviceTypes,
  seasonPeriods = [],
  depositPercent = 50,
  formId,
  compact = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState<FormData | null>(null);

  const seasons = useMemo(
    () =>
      seasonPeriods.map((season) => ({
        startsAt: new Date(season.startsAt),
        endsAt: new Date(season.endsAt),
        isActive: season.isActive,
      })),
    [seasonPeriods],
  );

  useEffect(() => {
    const form = formId
      ? document.getElementById(formId)
      : rootRef.current?.closest("form");
    if (!(form instanceof HTMLFormElement)) return;

    let frame = 0;
    const update = () => setSnapshot(new FormData(form));
    const queueUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    form.addEventListener("input", queueUpdate);
    form.addEventListener("change", queueUpdate);

    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("input", queueUpdate);
      form.removeEventListener("change", queueUpdate);
    };
  }, [formId]);

  const summary = useMemo(() => {
    const formData = snapshot ?? new FormData();
    const selectedService =
      serviceTypes.find((service) => service.id === String(formData.get("serviceTypeId") ?? "")) ??
      serviceTypes[0] ??
      null;
    const rules = sortPriceRules(selectedService?.priceRules ?? []);
    const selectedRule =
      rules.find((rule) => rule.id === String(formData.get("priceRuleId") ?? "")) ??
      (selectedService ? selectDefaultPriceRule(rules) : null);

    const startsAt = parseLocalDate(formData.get("startsAt"));
    const endsAt = parseLocalDate(formData.get("endsAt"));
    const petCount = formData.getAll("petIds").filter(Boolean).length;
    const chargeableUnits = startsAt && endsAt ? calculateChargeableStayUnits(startsAt, endsAt) : 0;
    const highSeason = startsAt ? isHighSeason(startsAt, seasons) : false;
    const unitBaseCents = selectedRule && petCount
      ? calculatePriceRuleUnitCents(selectedRule, petCount, highSeason)
      : 0;
    const automaticBaseCents = selectedRule && petCount && chargeableUnits
      ? calculatePriceRuleBaseCents(selectedRule, petCount, highSeason, chargeableUnits)
      : 0;
    const manualBaseRaw = String(formData.get("baseAmountCents") ?? "").trim();
    const manualBaseCents = manualBaseRaw ? parseCurrencyToCents(manualBaseRaw) : null;
    const baseAmountCents = manualBaseCents ?? automaticBaseCents;
    const distanceKm = parseDistanceKm(formData.get("distanceKm"));
    const pickupMode = String(formData.get("pickupMode") ?? "TUTOR_DROPS_OFF");
    const taxiRule = selectedRule && hasTaxiPricing(selectedRule)
      ? selectedRule
      : selectDefaultTaxiRule(serviceTypes);
    const taxiPetCents = taxiRule
      ? calculateTaxiPetCents({
          pickupMode: pickupMode === "ZENI_PICKUP" ? "ZENI_PICKUP" : "TUTOR_DROPS_OFF",
          fixedFeeCents: taxiRule.fixedFeeCents ?? 0,
          perKmCents: taxiRule.perKmCents ?? 0,
          hygieneFeeCents: taxiRule.hygieneFeeCents ?? 0,
          distanceKm,
        })
      : 0;
    const discountCents = centsFromForm(formData, "discountCents");
    const additionalCents = centsFromForm(formData, "additionalCents");
    const totals = calculateReservationTotals({
      baseAmountCents,
      discountCents,
      additionalCents,
      taxiPetCents,
      depositPercent,
    });

    return {
      selectedService,
      selectedRule,
      petCount,
      chargeableUnits,
      highSeason,
      unitBaseCents,
      automaticBaseCents,
      baseAmountCents,
      taxiRule,
      taxiPetCents,
      discountCents,
      additionalCents,
      ...totals,
    };
  }, [depositPercent, seasons, serviceTypes, snapshot]);

  return (
    <div
      ref={rootRef}
      style={{
        gridColumn: compact ? "1 / -1" : undefined,
        borderTop: "1px solid var(--border)",
        paddingTop: 12,
      }}
    >
      <div className="stack" style={{ gap: 10 }}>
        <div className="row row--between">
          <span className="muted">Serviço</span>
          <strong>{summary.selectedService?.name ?? "-"}</strong>
        </div>
        <div className="row row--between">
          <span className="muted">Tabela</span>
          <strong>{summary.selectedRule ? `${summary.selectedRule.label} - ${summary.selectedRule.paymentMethod}` : "-"}</strong>
        </div>
        <div className="row row--between">
          <span className="muted">Pets</span>
          <strong>{summary.petCount || "-"}</strong>
        </div>
        <div className="row row--between">
          <span className="muted">Diárias</span>
          <strong>{summary.chargeableUnits || "-"}</strong>
        </div>
        <div className="row row--between">
          <span className="muted">Base por diaria</span>
          <span>{brl(summary.unitBaseCents)}</span>
        </div>
        <div className="row row--between">
          <span className="muted">Base da estadia</span>
          <strong>{brl(summary.baseAmountCents)}</strong>
        </div>
        <div className="row row--between">
          <span className="muted">Taxi pet</span>
          <strong>{brl(summary.taxiPetCents)}</strong>
        </div>
        {summary.highSeason ? (
          <div className="row row--between">
            <span className="muted">Temporada</span>
            <strong>Alta</strong>
          </div>
        ) : null}
        {summary.discountCents || summary.additionalCents ? (
          <>
            <div className="row row--between">
              <span className="muted">Desconto</span>
              <span>{brl(summary.discountCents)}</span>
            </div>
            <div className="row row--between">
              <span className="muted">Adicionais</span>
              <span>{brl(summary.additionalCents)}</span>
            </div>
          </>
        ) : null}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }} className="row row--between">
          <strong>Total final</strong>
          <strong>{brl(summary.totalCents)}</strong>
        </div>
        <div className="row row--between">
          <span className="muted">Sinal sugerido</span>
          <strong>{brl(summary.depositSuggestedCents)}</strong>
        </div>
        <div className="row row--between">
          <span className="muted">Saldo</span>
          <strong>{brl(summary.balanceDueCents)}</strong>
        </div>
      </div>
    </div>
  );
}
