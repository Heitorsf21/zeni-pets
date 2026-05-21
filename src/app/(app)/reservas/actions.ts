"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentMethod } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { getTutorCreditBalance } from "@/lib/credits";
import { getPrisma } from "@/lib/db";
import { centsField, centsFieldStrict, optionalStringField, selectedValues, stringField } from "@/lib/forms";
import { addDays, parseDateOnly } from "@/lib/date";
import { formatPetServiceTitle } from "@/lib/reservation-title";
import {
  calculateManualDailyBaseCents,
  calculatePriceRuleStayCents,
  selectDefaultPriceRule,
} from "@/lib/pricing";
import { deriveInitialReservationStatus, derivePaymentStatus, sumPaidCents } from "@/lib/reservation-status";
import {
  calculateDailyUnitsForKind,
  countHighSeasonStayUnits,
  countHighSeasonUnitsFromDates,
  calculateReservationTotals,
} from "@/lib/rules";
import { generateTaskOccurrenceDates } from "@/lib/tasks";

const PAYMENT_METHODS: PaymentMethod[] = ["PIX", "CASH", "CARD", "TRANSFER", "OTHER"];

function asPaymentMethod(value: string): PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod)
    ? (value as PaymentMethod)
    : "PIX";
}

async function calculateBaseAmount(input: {
  serviceTypeId?: string;
  priceRuleId?: string;
  petCount: number;
  startsAt: Date;
  endsAt: Date;
  visitDates?: Date[];
}) {
  const prisma = getPrisma();
  const [serviceType, seasons, settings] = await Promise.all([
    prisma.serviceType.findUnique({
      where: { id: input.serviceTypeId ?? "" },
      include: {
        priceRules: {
          where: { isActive: true },
          orderBy: [{ paymentMethod: "asc" }, { label: "asc" }],
        },
      },
    }),
    prisma.seasonPeriod.findMany({ where: { isActive: true } }),
    prisma.businessSettings.findUnique({ where: { singletonKey: "default" } }),
  ]);

  const ruleFromDirectSelection = input.priceRuleId
    ? await prisma.servicePriceRule.findFirst({
        where: {
          id: input.priceRuleId,
          isActive: true,
          serviceType: { isActive: true },
        },
        include: { serviceType: true },
      })
    : null;

  if (input.priceRuleId && !ruleFromDirectSelection) {
    return { ok: false as const, reason: "regra-preco-invalida" };
  }

  if (ruleFromDirectSelection && input.serviceTypeId && ruleFromDirectSelection.serviceTypeId !== input.serviceTypeId) {
    return { ok: false as const, reason: "regra-servico-incompativel" };
  }

  const selectedService = ruleFromDirectSelection?.serviceType ?? serviceType;
  if (!selectedService?.isActive) {
    return { ok: false as const, reason: "servico-inativo-ou-inexistente" };
  }

  const rule = ruleFromDirectSelection ?? selectDefaultPriceRule(serviceType?.priceRules ?? []);

  const chargeableUnits = calculateDailyUnitsForKind({
    kind: selectedService.kind,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    visitDates: input.visitDates,
  });

  const highSeasonUnits = input.visitDates?.length
    ? countHighSeasonUnitsFromDates(input.visitDates, seasons)
    : countHighSeasonStayUnits(input.startsAt, input.endsAt, seasons);
  const highSeasonSurchargePercent = settings?.highSeasonSurchargePercent ?? 0;

  return {
    ok: true as const,
    serviceTypeId: selectedService.id,
    serviceKind: selectedService.kind,
    priceRule: rule,
    pricingPaymentMethod: rule?.paymentMethod ?? null,
    chargeableUnits,
    highSeasonUnits,
    baseAmountCents: rule
      ? calculatePriceRuleStayCents(
          rule,
          input.petCount,
          chargeableUnits,
          highSeasonUnits,
          { highSeasonSurchargePercent },
        )
      : 0,
    settings,
  };
}

function optionalStringFromValue(value: FormDataEntryValue | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function resolveBaseAmountCents(formData: FormData, options: {
  automaticBaseCents: number;
  chargeableUnits: number;
}): { ok: true; cents: number } | { ok: false; reason: string } {
  const rawMode = stringField(formData, "pricingMode");
  const mode = rawMode === "manual" ? "manual_daily" : rawMode;

  if (mode === "manual_total") {
    const total = centsFieldStrict(formData, "manualTotalAmountCents");
    if (total == null) return { ok: false, reason: "valor-total-manual-invalido" };
    return { ok: true, cents: Math.max(total, 0) };
  }

  if (mode === "manual_daily") {
    const daily = centsFieldStrict(formData, "manualDailyAmountCents")
      ?? centsFieldStrict(formData, "baseAmountCents");
    if (daily == null) return { ok: true, cents: 0 };
    return { ok: true, cents: calculateManualDailyBaseCents(daily, options.chargeableUnits) };
  }

  return { ok: true, cents: options.automaticBaseCents };
}

function reservationTaskDrafts(formData: FormData, input: {
  startsAt: Date;
  petIds: string[];
}) {
  const titles = formData.getAll("reservationTaskTitle");
  if (!titles.length) return [];

  const taskPetIds = formData.getAll("reservationTaskPetId");
  const taskDates = formData.getAll("reservationTaskDate");
  const taskEndsAt = formData.getAll("reservationTaskEndsAt");
  const descriptions = formData.getAll("reservationTaskDescription");

  return titles.map((rawTitle, index) => {
    const title = optionalStringFromValue(rawTitle);
    if (!title) redirect("/nova-reserva?error=tarefa-titulo-obrigatorio");

    const rawPetId = typeof taskPetIds[index] === "string" ? String(taskPetIds[index]).trim() : "";
    const petId = input.petIds.length === 1 ? input.petIds[0] : rawPetId;
    if (!petId || !input.petIds.includes(petId)) {
      redirect("/nova-reserva?error=tarefa-pet-obrigatorio");
    }

    const taskDate = parseDateOnly(taskDates[index] ?? null) ?? input.startsAt;
    const endsAt = parseDateOnly(taskEndsAt[index] ?? null);
    if (endsAt && endsAt.getTime() < taskDate.getTime()) {
      redirect("/nova-reserva?error=datas-invalidas");
    }

    return {
      title,
      description: optionalStringFromValue(descriptions[index]),
      taskDate,
      endsAt,
      petId,
    };
  });
}

type ParsedReservationPeriod = {
  startsAt: Date | null;
  endsAt: Date | null;
  visitDates: Date[];
};

function parseReservationPeriod(formData: FormData, kind: string | null): ParsedReservationPeriod {
  if (kind === "PET_SITTING") {
    const rawDates = formData.getAll("visitDates");
    const dates = rawDates
      .map((value) => parseDateOnly(value))
      .filter((date): date is Date => date != null)
      .sort((a, b) => a.getTime() - b.getTime());
    if (!dates.length) {
      const legacyVisit = parseDateOnly(formData.get("visitDate"));
      if (legacyVisit) dates.push(legacyVisit);
    }
    if (!dates.length) return { startsAt: null, endsAt: null, visitDates: [] };
    const first = dates[0];
    const last = dates[dates.length - 1];
    return { startsAt: first, endsAt: addDays(last, 1), visitDates: dates };
  }

  if (kind === "DAYCARE") {
    const start = parseDateOnly(formData.get("startsAt"));
    if (!start) return { startsAt: null, endsAt: null, visitDates: [] };
    return { startsAt: start, endsAt: addDays(start, 1), visitDates: [] };
  }

  const start = parseDateOnly(formData.get("startsAt"));
  const end = parseDateOnly(formData.get("endsAt"));
  if (!start || !end) return { startsAt: null, endsAt: null, visitDates: [] };
  return { startsAt: start, endsAt: end, visitDates: [] };
}

type PetOverride = {
  petId: string;
  serviceTypeId: string | null;
  priceRuleId: string | null;
  pricingMode: "fixed" | "manual_daily" | "manual_total";
  manualDailyCents: number | null;
  manualTotalCents: number | null;
};

function extractPetOverrides(formData: FormData, petIds: string[]): PetOverride[] {
  return petIds.flatMap((petId) => {
    const enabled = formData.get(`petOverride.${petId}.enabled`);
    if (!enabled) return [];
    const rawMode = String(formData.get(`petOverride.${petId}.pricingMode`) ?? "fixed");
    const pricingMode: PetOverride["pricingMode"] =
      rawMode === "manual_daily" || rawMode === "manual_total" ? rawMode : "fixed";
    const serviceTypeId = stringField(formData, `petOverride.${petId}.serviceTypeId`) || null;
    const priceRuleId = stringField(formData, `petOverride.${petId}.priceRuleId`) || null;
    const manualDailyCents = pricingMode === "manual_daily"
      ? centsFieldStrict(formData, `petOverride.${petId}.manualDailyCents`)
      : null;
    const manualTotalCents = pricingMode === "manual_total"
      ? centsFieldStrict(formData, `petOverride.${petId}.manualTotalCents`)
      : null;
    return [{
      petId,
      serviceTypeId,
      priceRuleId,
      pricingMode,
      manualDailyCents,
      manualTotalCents,
    }];
  });
}

async function calculatePetOverrideBase(
  override: PetOverride,
  options: { chargeableUnits: number; highSeasonUnits: number; highSeasonSurchargePercent: number },
): Promise<number> {
  if (override.pricingMode === "manual_total") {
    return Math.max(override.manualTotalCents ?? 0, 0);
  }
  if (override.pricingMode === "manual_daily") {
    if (override.manualDailyCents == null) return 0;
    return calculateManualDailyBaseCents(override.manualDailyCents, options.chargeableUnits);
  }
  if (!override.priceRuleId) return 0;
  const rule = await getPrisma().servicePriceRule.findUnique({ where: { id: override.priceRuleId } });
  if (!rule) return 0;
  return calculatePriceRuleStayCents(rule, 1, options.chargeableUnits, options.highSeasonUnits, {
    highSeasonSurchargePercent: options.highSeasonSurchargePercent,
  });
}

async function resolveServiceKind(serviceTypeId: string | null, priceRuleId: string | null): Promise<string | null> {
  if (!serviceTypeId && !priceRuleId) return null;
  const prisma = getPrisma();
  if (serviceTypeId) {
    const service = await prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      select: { kind: true },
    });
    if (service) return service.kind;
  }
  if (priceRuleId) {
    const rule = await prisma.servicePriceRule.findUnique({
      where: { id: priceRuleId },
      select: { serviceType: { select: { kind: true } } },
    });
    return rule?.serviceType.kind ?? null;
  }
  return null;
}

export async function createReservationAction(formData: FormData) {
  await requireUser();
  const tutorId = stringField(formData, "tutorId");
  const serviceTypeId = stringField(formData, "serviceTypeId");
  const priceRuleId = stringField(formData, "priceRuleId");
  const petIds = Array.from(new Set(selectedValues(formData, "petIds")));
  const kind = await resolveServiceKind(serviceTypeId, priceRuleId);
  const { startsAt, endsAt, visitDates } = parseReservationPeriod(formData, kind);

  if (!tutorId || (!serviceTypeId && !priceRuleId) || !petIds.length || !startsAt || !endsAt) {
    redirect("/nova-reserva?error=dados-obrigatorios");
  }
  if (kind === "PET_SITTING") {
    if (!visitDates.length) redirect("/nova-reserva?error=datas-visita-obrigatorias");
  } else if (kind === "DAYCARE") {
    // Single-day daycare: startsAt/endsAt cover the same calendar day.
  } else if (endsAt.getTime() <= startsAt.getTime()) {
    redirect("/nova-reserva?error=datas-invalidas");
  }

  // Reject pets that don't belong to the chosen tutor (the form lists every pet,
  // so the user can mistakenly select one from another tutor).
  const pets = await getPrisma().pet.findMany({
    where: { id: { in: petIds } },
    select: { id: true, tutorId: true },
  });
  if (pets.length !== petIds.length || pets.some((pet) => pet.tutorId !== tutorId)) {
    redirect("/nova-reserva?error=pets-do-tutor");
  }

  const base = await calculateBaseAmount({
    serviceTypeId,
    priceRuleId,
    petCount: petIds.length,
    startsAt,
    endsAt,
    visitDates,
  });
  if (!base.ok) redirect(`/nova-reserva?error=${base.reason}`);

  const taxiPetCents = centsField(formData, "taxiPetCents", 0);

  const overrides = extractPetOverrides(formData, petIds);
  const overrideByPetId = new Map(overrides.map((override) => [override.petId, override]));

  const resolvedBase = resolveBaseAmountCents(formData, {
    automaticBaseCents: base.baseAmountCents,
    chargeableUnits: base.chargeableUnits,
  });
  if (!resolvedBase.ok) redirect(`/nova-reserva?error=${resolvedBase.reason}`);
  const baseFromMain = resolvedBase.cents;

  const highSeasonSurchargePercent = base.settings?.highSeasonSurchargePercent ?? 0;
  const overrideCents = new Map<string, number>();
  for (const override of overrides) {
    const cents = await calculatePetOverrideBase(override, {
      chargeableUnits: base.chargeableUnits,
      highSeasonUnits: base.highSeasonUnits,
      highSeasonSurchargePercent,
    });
    overrideCents.set(override.petId, cents);
  }

  let baseAmountCents = baseFromMain;
  if (overrides.length > 0 && base.priceRule) {
    const soloFirstPet = calculatePriceRuleStayCents(base.priceRule, 1, base.chargeableUnits, base.highSeasonUnits, {
      highSeasonSurchargePercent,
    });
    baseAmountCents = petIds.reduce((sum, petId) => {
      const override = overrideByPetId.get(petId);
      if (override) return sum + (overrideCents.get(petId) ?? 0);
      return sum + soloFirstPet;
    }, 0);
  }

  const discountCents = centsField(formData, "discountCents", 0);
  const additionalCents = centsField(formData, "additionalCents", 0);

  const totals = calculateReservationTotals({
    baseAmountCents,
    discountCents,
    additionalCents,
    taxiPetCents,
    depositPercent: base.settings?.depositPercent ?? 50,
  });
  const taskDrafts = reservationTaskDrafts(formData, { startsAt, petIds });
  const initialStatus = deriveInitialReservationStatus({ startsAt, endsAt });

  const rawMainMode = stringField(formData, "pricingMode");
  const persistedPricingMode =
    rawMainMode === "manual_daily" || rawMainMode === "manual_total"
      ? rawMainMode
      : rawMainMode === "manual"
        ? "manual_daily"
        : "fixed";
  const persistedManualDaily = centsFieldStrict(formData, "manualDailyAmountCents");
  const persistedManualTotal = centsFieldStrict(formData, "manualTotalAmountCents");

  const reservation = await getPrisma().$transaction(async (tx) => {
    const created = await tx.reservation.create({
      data: {
        tutorId,
        serviceTypeId: base.serviceTypeId,
        priceRuleId: base.priceRule?.id ?? null,
        pricingPaymentMethod: base.pricingPaymentMethod,
        pricingMode: persistedPricingMode,
        manualDailyCents: persistedManualDaily,
        manualTotalCents: persistedManualTotal,
        status: initialStatus,
        paymentStatus: "PENDING",
        startsAt,
        endsAt,
        notes: optionalStringField(formData, "notes"),
        inviteTutor: formData.get("inviteTutor") === "on",
        baseAmountCents,
        discountCents,
        additionalCents,
        taxiPetCents,
        totalCents: totals.totalCents,
        depositSuggestedCents: totals.depositSuggestedCents,
        depositDueCents: totals.depositDueCents,
        balanceDueCents: totals.balanceDueCents,
        reservationPets: {
          create: petIds.map((petId, index) => {
            const override = overrideByPetId.get(petId);
            return {
              petId,
              priceRole: index === 0 ? "first_pet" : "additional_pet",
              serviceTypeId: override?.serviceTypeId ?? null,
              priceRuleId: override?.priceRuleId ?? null,
              pricingMode: override?.pricingMode ?? null,
              manualDailyCents: override?.manualDailyCents ?? null,
              manualTotalCents: override?.manualTotalCents ?? null,
              baseAmountCents: override ? overrideCents.get(petId) ?? 0 : 0,
            };
          }),
        },
        ...(visitDates.length
          ? {
              visitDates: {
                create: visitDates.map((date) => ({ date })),
              },
            }
          : {}),
      },
      include: { tutor: true, serviceType: true, reservationPets: { include: { pet: true } } },
    });

    for (const taskDraft of taskDrafts) {
      const occurrenceDates = generateTaskOccurrenceDates(taskDraft.taskDate, taskDraft.endsAt);
      await tx.task.create({
        data: {
          title: taskDraft.title,
          description: taskDraft.description,
          taskDate: taskDraft.taskDate,
          endsAt: taskDraft.endsAt,
          status: "PENDING",
          source: "MANUAL",
          tutorId,
          petId: taskDraft.petId,
          reservationId: created.id,
          occurrences: {
            create: occurrenceDates.map((date) => ({ occurrenceDate: date })),
          },
        },
      });
    }

    return created;
  });

  await syncReservationToGoogleIfConfigured(reservation.id);

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/financeiro");
  if (taskDrafts.length) {
    for (const petId of new Set(taskDrafts.map((task) => task.petId))) {
      revalidatePath(`/pets/${petId}`);
    }
    revalidatePath(`/tutores/${tutorId}`);
  }
  redirect(`/reservas/${reservation.id}`);
}

export async function updateReservationStatusAction(
  id: string,
  status: "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
) {
  await requireUser();
  const reservation = await getPrisma().reservation.update({
    where: { id },
    data: { status },
  });

  if (status === "CANCELLED") {
    await getPrisma().reservation.update({
      where: { id },
      data: { paymentStatus: "CANCELLED" },
    });
  }

  if (status === "COMPLETED") {
    const payments = await getPrisma().payment.findMany({
      where: { reservationId: id },
      select: { status: true, amountCents: true },
    });
    await getPrisma().reservation.update({
      where: { id },
      data: { paymentStatus: derivePaymentStatus(sumPaidCents(payments), reservation.totalCents) },
    });
  }

  await syncReservationToGoogleIfConfigured(id);
  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath(`/reservas/${id}`);
}

export async function updateReservationAction(id: string, formData: FormData) {
  await requireUser();
  const tutorId = stringField(formData, "tutorId");
  const serviceTypeId = stringField(formData, "serviceTypeId");
  const priceRuleId = stringField(formData, "priceRuleId");
  const petIds = Array.from(new Set(selectedValues(formData, "petIds")));
  const kind = await resolveServiceKind(serviceTypeId, priceRuleId);
  const { startsAt, endsAt, visitDates } = parseReservationPeriod(formData, kind);

  if (!tutorId || (!serviceTypeId && !priceRuleId) || !petIds.length || !startsAt || !endsAt) {
    redirect(`/reservas/${id}/editar?error=dados-obrigatorios`);
  }
  if (kind === "PET_SITTING") {
    if (!visitDates.length) redirect(`/reservas/${id}/editar?error=datas-visita-obrigatorias`);
  } else if (kind === "DAYCARE") {
    // Single-day daycare allowed.
  } else if (endsAt.getTime() <= startsAt.getTime()) {
    redirect(`/reservas/${id}/editar?error=datas-invalidas`);
  }

  const pets = await getPrisma().pet.findMany({
    where: { id: { in: petIds } },
    select: { id: true, tutorId: true },
  });
  if (pets.length !== petIds.length || pets.some((pet) => pet.tutorId !== tutorId)) {
    redirect(`/reservas/${id}/editar?error=pets-do-tutor`);
  }

  const base = await calculateBaseAmount({
    serviceTypeId,
    priceRuleId,
    petCount: petIds.length,
    startsAt,
    endsAt,
    visitDates,
  });
  if (!base.ok) redirect(`/reservas/${id}/editar?error=${base.reason}`);

  const taxiPetCents = centsField(formData, "taxiPetCents", 0);

  const overridesUpdate = extractPetOverrides(formData, petIds);
  const overrideByPetIdUpdate = new Map(overridesUpdate.map((override) => [override.petId, override]));

  const resolvedBase = resolveBaseAmountCents(formData, {
    automaticBaseCents: base.baseAmountCents,
    chargeableUnits: base.chargeableUnits,
  });
  if (!resolvedBase.ok) redirect(`/reservas/${id}/editar?error=${resolvedBase.reason}`);
  const baseFromMainUpdate = resolvedBase.cents;

  const highSeasonSurchargePercentUpdate = base.settings?.highSeasonSurchargePercent ?? 0;
  const overrideCentsUpdate = new Map<string, number>();
  for (const override of overridesUpdate) {
    const cents = await calculatePetOverrideBase(override, {
      chargeableUnits: base.chargeableUnits,
      highSeasonUnits: base.highSeasonUnits,
      highSeasonSurchargePercent: highSeasonSurchargePercentUpdate,
    });
    overrideCentsUpdate.set(override.petId, cents);
  }

  let baseAmountCents = baseFromMainUpdate;
  if (overridesUpdate.length > 0 && base.priceRule) {
    const soloFirstPet = calculatePriceRuleStayCents(base.priceRule, 1, base.chargeableUnits, base.highSeasonUnits, {
      highSeasonSurchargePercent: highSeasonSurchargePercentUpdate,
    });
    baseAmountCents = petIds.reduce((sum, petId) => {
      const override = overrideByPetIdUpdate.get(petId);
      if (override) return sum + (overrideCentsUpdate.get(petId) ?? 0);
      return sum + soloFirstPet;
    }, 0);
  }

  const discountCents = centsField(formData, "discountCents", 0);
  const additionalCents = centsField(formData, "additionalCents", 0);

  const existing = await getPrisma().reservation.findUnique({
    where: { id },
    include: { reservationPets: true, payments: true, tasks: true, tutor: true },
  });
  if (!existing) redirect("/reservas?error=reserva-nao-encontrada");

  const totals = calculateReservationTotals({
    baseAmountCents,
    discountCents,
    additionalCents,
    taxiPetCents,
    lateFeeCents: existing.lateFeeCents,
    depositPercent: base.settings?.depositPercent ?? 50,
  });

  const previousPetIds = existing.reservationPets.map((rp) => rp.petId);
  const previousTutorId = existing.tutorId;

  const rawMainModeUpdate = stringField(formData, "pricingMode");
  const persistedPricingModeUpdate =
    rawMainModeUpdate === "manual_daily" || rawMainModeUpdate === "manual_total"
      ? rawMainModeUpdate
      : rawMainModeUpdate === "manual"
        ? "manual_daily"
        : "fixed";
  const persistedManualDailyUpdate = centsFieldStrict(formData, "manualDailyAmountCents");
  const persistedManualTotalUpdate = centsFieldStrict(formData, "manualTotalAmountCents");

  await getPrisma().$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data: {
        tutorId,
        serviceTypeId: base.serviceTypeId,
        priceRuleId: base.priceRule?.id ?? null,
        pricingPaymentMethod: base.pricingPaymentMethod,
        pricingMode: persistedPricingModeUpdate,
        manualDailyCents: persistedManualDailyUpdate,
        manualTotalCents: persistedManualTotalUpdate,
        startsAt,
        endsAt,
        notes: optionalStringField(formData, "notes"),
        inviteTutor: formData.get("inviteTutor") === "on",
        baseAmountCents,
        discountCents,
        additionalCents,
        taxiPetCents,
        totalCents: totals.totalCents,
        depositSuggestedCents: totals.depositSuggestedCents,
        depositDueCents: totals.depositDueCents,
        balanceDueCents: totals.balanceDueCents,
        paymentStatus: derivePaymentStatus(sumPaidCents(existing.payments), totals.totalCents),
      },
    });

    const removedPetIds = previousPetIds.filter((petId) => !petIds.includes(petId));
    const addedPetIds = petIds.filter((petId) => !previousPetIds.includes(petId));
    if (removedPetIds.length) {
      await tx.reservationPet.deleteMany({
        where: { reservationId: id, petId: { in: removedPetIds } },
      });
    }
    if (addedPetIds.length) {
      await tx.reservationPet.createMany({
        data: addedPetIds.map((petId) => ({ reservationId: id, petId, priceRole: "additional_pet" })),
        skipDuplicates: true,
      });
    }
    // Reassign priceRole + reaply overrides for every pet (including the ones that have no override → clear fields).
    for (let index = 0; index < petIds.length; index++) {
      const petId = petIds[index];
      const override = overrideByPetIdUpdate.get(petId);
      await tx.reservationPet.updateMany({
        where: { reservationId: id, petId },
        data: {
          priceRole: index === 0 ? "first_pet" : "additional_pet",
          serviceTypeId: override?.serviceTypeId ?? null,
          priceRuleId: override?.priceRuleId ?? null,
          pricingMode: override?.pricingMode ?? null,
          manualDailyCents: override?.manualDailyCents ?? null,
          manualTotalCents: override?.manualTotalCents ?? null,
          baseAmountCents: override ? overrideCentsUpdate.get(petId) ?? 0 : 0,
        },
      });
    }

    if (kind === "PET_SITTING") {
      await tx.reservationVisitDate.deleteMany({ where: { reservationId: id } });
      if (visitDates.length) {
        await tx.reservationVisitDate.createMany({
          data: visitDates.map((date) => ({ reservationId: id, date })),
          skipDuplicates: true,
        });
      }
    }
  });

  await syncReservationToGoogleIfConfigured(id);

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/financeiro");
  revalidatePath("/reservas");
  revalidatePath(`/reservas/${id}`);
  revalidatePath(`/tutores/${tutorId}`);
  revalidatePath(`/tutores/${tutorId}/ficha`);
  if (previousTutorId && previousTutorId !== tutorId) {
    revalidatePath(`/tutores/${previousTutorId}`);
    revalidatePath(`/tutores/${previousTutorId}/ficha`);
  }
  const touchedPets = new Set([...previousPetIds, ...petIds]);
  for (const petId of touchedPets) {
    revalidatePath(`/pets/${petId}`);
    revalidatePath(`/pets/${petId}/ficha`);
  }
  redirect(`/reservas/${id}?saved=1`);
}

export async function registerPaymentAction(id: string, formData: FormData) {
  await requireUser();
  const amountCents = centsFieldStrict(formData, "amountCents");
  if (amountCents == null || amountCents <= 0) redirect(`/reservas/${id}?error=valor-invalido`);

  const method = asPaymentMethod(stringField(formData, "method"));
  const reservation = await getPrisma().reservation.findUnique({
    where: { id },
    include: { tutor: true, serviceType: true, payments: true },
  });
  if (!reservation) redirect("/agenda?error=reserva-nao-encontrada");

  await getPrisma().payment.create({
    data: {
      reservationId: id,
      amountCents,
      method,
      status: "PAID",
      paidAt: new Date(),
      notes: optionalStringField(formData, "notes"),
    },
  });

  await getPrisma().financialEntry.create({
    data: {
      reservationId: id,
      kind: "INCOME",
      category: reservation.serviceType.name,
      description: `Pagamento - ${reservation.tutor.name}`,
      entryDate: new Date(),
      amountCents,
      method,
    },
  });

  const paid = sumPaidCents(reservation.payments) + amountCents;
  await getPrisma().reservation.update({
    where: { id },
    data: { paymentStatus: derivePaymentStatus(paid, reservation.totalCents) },
  });

  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
  revalidatePath(`/reservas/${id}`);
}

export async function useTutorCreditAction(id: string, formData: FormData) {
  await requireUser();
  const amountCents = centsFieldStrict(formData, "amountCents");
  if (amountCents == null || amountCents <= 0) redirect(`/reservas/${id}?error=valor-invalido`);

  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id },
      include: { tutor: true, serviceType: true, payments: true },
    });
    if (!reservation) return { ok: false as const, reason: "reserva-nao-encontrada" };

    const balance = await getTutorCreditBalance(tx, reservation.tutorId);
    const paidCents = reservation.payments
      .filter((payment) => payment.status === "PAID")
      .reduce((total, payment) => total + payment.amountCents, 0);
    const remainingCents = Math.max(reservation.totalCents - paidCents, 0);

    if (amountCents > balance || amountCents > remainingCents) {
      return { ok: false as const, reason: "credito-insuficiente" };
    }

    await tx.payment.create({
      data: {
        reservationId: id,
        amountCents,
        method: "CREDIT",
        status: "PAID",
        paidAt: new Date(),
        notes: "Uso de crédito do cliente",
      },
    });

    await tx.financialEntry.create({
      data: {
        reservationId: id,
        kind: "INCOME",
        category: reservation.serviceType.name,
        description: `Uso de crédito - ${reservation.tutor.name}`,
        entryDate: new Date(),
        amountCents,
        method: "CREDIT",
      },
    });

    await tx.tutorCreditTransaction.create({
      data: {
        tutorId: reservation.tutorId,
        reservationId: id,
        type: "CREDIT_USED",
        amountCents: -amountCents,
        description: `Crédito usado na reserva ${reservation.serviceType.name}`,
        entryDate: new Date(),
      },
    });

    const newPaidCents = paidCents + amountCents;
    await tx.reservation.update({
      where: { id },
      data: { paymentStatus: derivePaymentStatus(newPaidCents, reservation.totalCents) },
    });

    return { ok: true as const, tutorId: reservation.tutorId };
  });

  if (!result.ok) {
    redirect(`/reservas/${id}?error=${result.reason}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
  revalidatePath("/tutores");
  revalidatePath(`/tutores/${result.tutorId}`);
  revalidatePath(`/tutores/${result.tutorId}/ficha`);
  revalidatePath(`/reservas/${id}`);
  redirect(`/reservas/${id}?saved=credit`);
}

export async function deleteReservationAction(id: string) {
  await requireUser();
  const reservation = await getPrisma().reservation.findUnique({
    where: { id },
    select: { status: true, googleEventId: true, googleCalendarId: true },
  });
  if (!reservation) redirect("/agenda?error=reserva-nao-encontrada");

  if (reservation.status !== "REQUESTED" && reservation.status !== "CANCELLED") {
    redirect(`/reservas/${id}?error=reserva-nao-removivel`);
  }

  // Best-effort Google cleanup; never block the delete on a sync failure.
  if (reservation.googleEventId && reservation.googleCalendarId) {
    const connection = await getPrisma().googleCalendarConnection.findFirst({
      orderBy: { connectedAt: "desc" },
    });
    if (connection) {
      try {
        const { cancelReservationEvent } = await import("@/lib/google/calendar");
        await cancelReservationEvent({
          tokens: connection,
          calendarId: reservation.googleCalendarId,
          googleEventId: reservation.googleEventId,
        });
      } catch {
        // Ignore — the Google event will remain orphaned if cleanup fails.
      }
    }
  }

  await getPrisma().reservation.delete({ where: { id } });

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/financeiro");
  redirect("/agenda?deleted=1");
}

async function syncReservationToGoogleIfConfigured(reservationId: string) {
  const prisma = getPrisma();
  const connection = await prisma.googleCalendarConnection.findFirst({
    where: { googleCalendarId: { not: null } },
    orderBy: { connectedAt: "desc" },
  });
  if (!connection?.googleCalendarId) return;

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: {
      tutor: true,
      serviceType: true,
      reservationPets: { include: { pet: true } },
    },
  });
  if (!reservation) return;

  try {
    const { upsertReservationEvent } = await import("@/lib/google/calendar");
    const event = await upsertReservationEvent({
      tokens: connection,
      calendarId: connection.googleCalendarId,
      googleEventId: reservation.googleEventId,
      reservation: {
        reservationId,
        title: formatPetServiceTitle({
          petNames: reservation.reservationPets.map((item) => item.pet.name),
          serviceName: reservation.serviceType.name,
        }),
        startsAt: reservation.startsAt,
        endsAt: reservation.endsAt,
        tutorEmail: reservation.tutor.email,
        inviteTutor: reservation.inviteTutor,
        notes: reservation.notes,
      },
    });

    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        googleCalendarId: connection.googleCalendarId,
        googleEventId: event.id ?? reservation.googleEventId,
        googleEventEtag: event.etag ?? reservation.googleEventEtag,
        googleLastSyncedAt: new Date(),
        syncConflict: false,
        syncConflictReason: null,
      },
    });
  } catch (error) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        syncConflict: true,
        syncConflictReason: error instanceof Error ? error.message : "Falha ao sincronizar Google Agenda",
      },
    });
  }
}
