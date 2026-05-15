"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brl, parseCurrencyToCents } from "@/lib/money";
import {
  calculateManualDailyBaseCents,
  calculatePriceRuleStayCents,
  calculatePriceRuleUnitCents,
  hasTaxiPricing,
  selectDefaultPriceRule,
  selectDefaultTaxiRule,
  sortPriceRules,
} from "@/lib/pricing";
import type { ReservationSeasonOption, ReservationServiceOption } from "@/lib/reservation-form-options";
import {
  calculateChargeableStayUnits,
  countHighSeasonStayUnits,
  calculateReservationTotals,
  calculateTaxiPetCents,
} from "@/lib/rules";

type Props = {
  serviceTypes: ReservationServiceOption[];
  seasonPeriods?: ReservationSeasonOption[];
  depositPercent?: number;
  highSeasonSurchargePercent?: number;
  formId?: string;
  compact?: boolean;
};

function parseLocalDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [y, m, d] = trimmed.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addOneDay(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + 1);
  return copy;
}

function isPetSittingService(service: { kind?: string | null } | null | undefined) {
  return service?.kind === "PET_SITTING";
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
  highSeasonSurchargePercent = 0,
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

    const petSitting = isPetSittingService(selectedService);
    let startsAt: Date | null;
    let endsAtExclusive: Date | null;
    if (petSitting) {
      const visit = parseLocalDate(formData.get("visitDate")) ?? parseLocalDate(formData.get("startsAt"));
      startsAt = visit;
      endsAtExclusive = visit ? addOneDay(visit) : null;
    } else {
      startsAt = parseLocalDate(formData.get("startsAt"));
      const endsAtInclusive = parseLocalDate(formData.get("endsAt"));
      endsAtExclusive = endsAtInclusive ? addOneDay(endsAtInclusive) : null;
    }
    const petCount = formData.getAll("petIds").filter(Boolean).length;
    const chargeableUnits = startsAt && endsAtExclusive ? calculateChargeableStayUnits(startsAt, endsAtExclusive) : 0;
    const highSeasonUnits = startsAt && endsAtExclusive ? countHighSeasonStayUnits(startsAt, endsAtExclusive, seasons) : 0;
    const hasHighSeason = highSeasonUnits > 0;
    const priceOptions = { highSeasonSurchargePercent };
    const unitBaseCents = selectedRule && petCount
      ? calculatePriceRuleUnitCents(selectedRule, petCount, false, priceOptions)
      : 0;
    const highSeasonUnitBaseCents = selectedRule && petCount
      ? calculatePriceRuleUnitCents(selectedRule, petCount, true, priceOptions)
      : 0;
    const automaticBaseCents = selectedRule && petCount && chargeableUnits
      ? calculatePriceRuleStayCents(selectedRule, petCount, chargeableUnits, highSeasonUnits, priceOptions)
      : 0;
    const pricingMode = String(formData.get("pricingMode") ?? "fixed");
    const manualDailyRaw = String(
      formData.get("manualDailyAmountCents") ?? formData.get("baseAmountCents") ?? "",
    ).trim();
    const manualDailyCents = manualDailyRaw ? parseCurrencyToCents(manualDailyRaw) : null;
    const manualBaseCents = manualDailyCents != null && chargeableUnits
      ? calculateManualDailyBaseCents(manualDailyCents, chargeableUnits)
      : null;
    const baseAmountCents = pricingMode === "manual" && manualBaseCents != null
      ? manualBaseCents
      : automaticBaseCents;
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
      highSeasonUnits,
      hasHighSeason,
      unitBaseCents,
      highSeasonUnitBaseCents,
      automaticBaseCents,
      manualDailyCents,
      manualBaseCents,
      baseAmountCents,
      pricingMode,
      taxiRule,
      taxiPetCents,
      discountCents,
      additionalCents,
      ...totals,
    };
  }, [depositPercent, highSeasonSurchargePercent, seasons, serviceTypes, snapshot]);

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
          <span className="muted">Modo</span>
          <strong>{summary.pricingMode === "manual" ? "Diaria manual" : "Valor fixado"}</strong>
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
        {summary.hasHighSeason ? (
          <div className="row row--between">
            <span className="muted">Alta temporada</span>
            <span>
              {summary.highSeasonUnits} diaria{summary.highSeasonUnits === 1 ? "" : "s"}
              {summary.pricingMode === "fixed" ? ` - ${brl(summary.highSeasonUnitBaseCents)}/dia` : ""}
            </span>
          </div>
        ) : null}
        {summary.pricingMode === "manual" ? (
          <div className="row row--between">
            <span className="muted">Diaria manual</span>
            <span>{summary.manualDailyCents != null ? brl(summary.manualDailyCents) : "-"}</span>
          </div>
        ) : null}
        <div className="row row--between">
          <span className="muted">Base da estadia</span>
          <strong>{brl(summary.baseAmountCents)}</strong>
        </div>
        <div className="row row--between">
          <span className="muted">Taxi pet</span>
          <strong>{brl(summary.taxiPetCents)}</strong>
        </div>
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
