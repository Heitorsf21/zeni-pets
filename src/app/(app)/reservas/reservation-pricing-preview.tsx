"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { brl, parseCurrencyToCents } from "@/lib/money";
import {
  calculateManualDailyBaseCents,
  calculatePriceRuleStayCents,
  calculatePriceRuleUnitCents,
  selectDefaultPriceRule,
  sortPriceRules,
} from "@/lib/pricing";
import type { ReservationSeasonOption, ReservationServiceOption } from "@/lib/reservation-form-options";
import {
  calculateDailyUnitsForKind,
  countHighSeasonStayUnits,
  countHighSeasonUnitsFromDates,
  calculateReservationTotals,
} from "@/lib/rules";

type Props = {
  serviceTypes: ReservationServiceOption[];
  seasonPeriods?: ReservationSeasonOption[];
  depositPercent?: number;
  highSeasonSurchargePercent?: number;
  formId?: string;
  compact?: boolean;
  defaultServiceTypeId?: string;
  defaultPriceRuleId?: string;
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
  defaultServiceTypeId,
  defaultPriceRuleId,
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
    const serviceTypeId = String(formData.get("serviceTypeId") ?? "") || defaultServiceTypeId;
    const priceRuleId = String(formData.get("priceRuleId") ?? "") || defaultPriceRuleId;
    const selectedService =
      serviceTypes.find((service) => service.id === serviceTypeId) ??
      serviceTypes.find((service) => service.priceRules.some((rule) => rule.id === priceRuleId)) ??
      serviceTypes[0] ??
      null;
    const rules = sortPriceRules(selectedService?.priceRules ?? []);
    const selectedRule =
      rules.find((rule) => rule.id === priceRuleId) ??
      (selectedService ? selectDefaultPriceRule(rules) : null);

    const kind = selectedService?.kind ?? "";

    let startsAt: Date | null;
    let endsAtExclusive: Date | null;
    let visitDates: Date[] = [];

    if (kind === "PET_SITTING") {
      const rawDates = formData.getAll("visitDates");
      visitDates = rawDates
        .map((value) => parseLocalDate(value))
        .filter((date): date is Date => date != null)
        .sort((a, b) => a.getTime() - b.getTime());
      if (!visitDates.length) {
        const legacy = parseLocalDate(formData.get("visitDate"));
        if (legacy) visitDates = [legacy];
      }
      startsAt = visitDates[0] ?? null;
      endsAtExclusive = visitDates.length ? addOneDay(visitDates[visitDates.length - 1]) : null;
    } else if (kind === "DAYCARE") {
      startsAt = parseLocalDate(formData.get("startsAt"));
      endsAtExclusive = startsAt ? addOneDay(startsAt) : null;
    } else {
      startsAt = parseLocalDate(formData.get("startsAt"));
      endsAtExclusive = parseLocalDate(formData.get("endsAt"));
    }

    const petCount = formData.getAll("petIds").filter(Boolean).length;
    const chargeableUnits =
      startsAt && endsAtExclusive
        ? calculateDailyUnitsForKind({ kind, startsAt, endsAt: endsAtExclusive, visitDates })
        : 0;
    const highSeasonUnits = visitDates.length
      ? countHighSeasonUnitsFromDates(visitDates, seasons)
      : startsAt && endsAtExclusive
        ? countHighSeasonStayUnits(startsAt, endsAtExclusive, seasons)
        : 0;
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
    const rawMode = String(formData.get("pricingMode") ?? "fixed");
    const pricingMode = rawMode === "manual" ? "manual_daily" : rawMode;

    const manualDailyRaw = String(
      formData.get("manualDailyAmountCents") ?? formData.get("baseAmountCents") ?? "",
    ).trim();
    const manualDailyCents = manualDailyRaw ? parseCurrencyToCents(manualDailyRaw) : null;
    const manualDailyBaseCents = manualDailyCents != null
      ? calculateManualDailyBaseCents(manualDailyCents, Math.max(chargeableUnits, 1))
      : 0;

    const manualTotalRaw = String(formData.get("manualTotalAmountCents") ?? "").trim();
    const manualTotalCents = manualTotalRaw ? parseCurrencyToCents(manualTotalRaw) : null;

    let baseAmountCents: number;
    if (pricingMode === "manual_daily") {
      baseAmountCents = manualDailyBaseCents;
    } else if (pricingMode === "manual_total") {
      baseAmountCents = manualTotalCents ?? 0;
    } else {
      baseAmountCents = automaticBaseCents;
    }

    const petIds = formData.getAll("petIds").map(String).filter(Boolean);
    const overrides = petIds.flatMap((petId) => {
      const enabled = formData.get(`petOverride.${petId}.enabled`);
      if (!enabled) return [];
      const rawOverrideMode = String(formData.get(`petOverride.${petId}.pricingMode`) ?? "fixed");
      const mode = rawOverrideMode === "manual_daily" || rawOverrideMode === "manual_total" ? rawOverrideMode : "fixed";
      const serviceTypeId = String(formData.get(`petOverride.${petId}.serviceTypeId`) ?? "");
      const priceRuleId = String(formData.get(`petOverride.${petId}.priceRuleId`) ?? "");
      const dailyRaw = String(formData.get(`petOverride.${petId}.manualDailyCents`) ?? "").trim();
      const totalRaw = String(formData.get(`petOverride.${petId}.manualTotalCents`) ?? "").trim();
      const dailyCents = dailyRaw ? parseCurrencyToCents(dailyRaw) : null;
      const totalCents = totalRaw ? parseCurrencyToCents(totalRaw) : null;

      let cents = 0;
      if (mode === "manual_total") {
        cents = Math.max(totalCents ?? 0, 0);
      } else if (mode === "manual_daily" && dailyCents != null) {
        cents = calculateManualDailyBaseCents(dailyCents, Math.max(chargeableUnits, 1));
      } else if (mode === "fixed" && priceRuleId) {
        const overrideService = serviceTypes.find((s) => s.id === serviceTypeId) ?? null;
        const overrideRule = overrideService?.priceRules.find((r) => r.id === priceRuleId) ?? null;
        if (overrideRule) {
          cents = calculatePriceRuleStayCents(
            overrideRule,
            1,
            Math.max(chargeableUnits, 1),
            highSeasonUnits,
            priceOptions,
          );
        }
      }
      return [{ petId, cents }];
    });

    if (overrides.length > 0 && selectedRule) {
      const soloFirstPet = calculatePriceRuleStayCents(
        selectedRule,
        1,
        Math.max(chargeableUnits, 1),
        highSeasonUnits,
        priceOptions,
      );
      baseAmountCents = petIds.reduce((sum, petId) => {
        const override = overrides.find((o) => o.petId === petId);
        if (override) return sum + override.cents;
        return sum + soloFirstPet;
      }, 0);
    }

    const taxiPetCents = centsFromForm(formData, "taxiPetCents");
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
      kind,
      petCount,
      visitDates,
      chargeableUnits,
      highSeasonUnits,
      hasHighSeason,
      unitBaseCents,
      highSeasonUnitBaseCents,
      automaticBaseCents,
      manualDailyCents,
      manualDailyBaseCents,
      manualTotalCents,
      baseAmountCents,
      pricingMode,
      taxiPetCents,
      discountCents,
      additionalCents,
      ...totals,
    };
  }, [defaultPriceRuleId, defaultServiceTypeId, depositPercent, highSeasonSurchargePercent, seasons, serviceTypes, snapshot]);

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
          <strong>
            {summary.pricingMode === "manual_daily"
              ? "Manual por diária"
              : summary.pricingMode === "manual_total"
                ? "Total manual"
                : "Valor da tabela"}
          </strong>
        </div>
        <div className="row row--between">
          <span className="muted">Pets</span>
          <strong>{summary.petCount || "-"}</strong>
        </div>
        <div className="row row--between">
          <span className="muted">{summary.kind === "PET_SITTING" ? "Visitas" : "Diárias"}</span>
          <strong>{summary.chargeableUnits || "-"}</strong>
        </div>
        {summary.pricingMode === "fixed" ? (
          <div className="row row--between">
            <span className="muted">Base por diária</span>
            <span>{brl(summary.unitBaseCents)}</span>
          </div>
        ) : null}
        {summary.hasHighSeason ? (
          <div className="row row--between">
            <span className="muted">Alta temporada</span>
            <span>
              {summary.highSeasonUnits} {summary.highSeasonUnits === 1 ? "diária" : "diárias"}
              {summary.pricingMode === "fixed" ? ` · ${brl(summary.highSeasonUnitBaseCents)}/dia` : ""}
            </span>
          </div>
        ) : null}
        {summary.pricingMode === "manual_daily" ? (
          <div className="row row--between">
            <span className="muted">Diária manual</span>
            <span>{summary.manualDailyCents != null ? brl(summary.manualDailyCents) : brl(0)}</span>
          </div>
        ) : null}
        {summary.pricingMode === "manual_total" ? (
          <div className="row row--between">
            <span className="muted">Total manual</span>
            <span>{summary.manualTotalCents != null ? brl(summary.manualTotalCents) : brl(0)}</span>
          </div>
        ) : null}
        <div className="row row--between">
          <span className="muted">Base da estadia</span>
          <strong>{brl(summary.baseAmountCents)}</strong>
        </div>
        <div className="row row--between">
          <span className="muted">Taxa de táxi</span>
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
