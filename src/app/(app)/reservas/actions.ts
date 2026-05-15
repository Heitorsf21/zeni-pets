"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentMethod } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { getTutorCreditBalance } from "@/lib/credits";
import { getPrisma } from "@/lib/db";
import { centsField, centsFieldStrict, optionalStringField, selectedValues, stringField } from "@/lib/forms";
import { addDays, parseDateOnly } from "@/lib/date";
import {
  calculateManualDailyBaseCents,
  calculatePriceRuleStayCents,
  hasTaxiPricing,
  selectDefaultPriceRule,
  selectDefaultTaxiRule,
} from "@/lib/pricing";
import { deriveInitialReservationStatus, derivePaymentStatus, sumPaidCents } from "@/lib/reservation-status";
import {
  calculateChargeableStayUnits,
  countHighSeasonStayUnits,
  calculateReservationTotals,
  calculateTaxiPetCents,
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
}) {
  const prisma = getPrisma();
  const [serviceType, taxiServiceTypes, seasons, settings] = await Promise.all([
    prisma.serviceType.findUnique({
      where: { id: input.serviceTypeId ?? "" },
      include: {
        priceRules: {
          where: { isActive: true },
          orderBy: [{ paymentMethod: "asc" }, { label: "asc" }],
        },
      },
    }),
    prisma.serviceType.findMany({
      where: {
        isActive: true,
        OR: [
          { kind: "TAXI_PET" },
          {
            priceRules: {
              some: {
                isActive: true,
                OR: [
                  { fixedFeeCents: { not: null } },
                  { perKmCents: { not: null } },
                  { hygieneFeeCents: { not: null } },
                ],
              },
            },
          },
        ],
      },
      include: {
        priceRules: {
          where: { isActive: true },
          orderBy: [{ paymentMethod: "asc" }, { label: "asc" }],
        },
      },
      orderBy: { name: "asc" },
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
  if (!rule) return { ok: false as const, reason: "preco-nao-configurado" };

  const chargeableUnits = calculateChargeableStayUnits(input.startsAt, input.endsAt);
  const highSeasonUnits = countHighSeasonStayUnits(input.startsAt, input.endsAt, seasons);
  const highSeasonSurchargePercent = settings?.highSeasonSurchargePercent ?? 0;

  return {
    ok: true as const,
    serviceTypeId: selectedService.id,
    priceRule: rule,
    pricingPaymentMethod: rule.paymentMethod,
    chargeableUnits,
    highSeasonUnits,
    baseAmountCents: calculatePriceRuleStayCents(
      rule,
      input.petCount,
      chargeableUnits,
      highSeasonUnits,
      { highSeasonSurchargePercent },
    ),
    taxiRule: hasTaxiPricing(rule) ? rule : selectDefaultTaxiRule(taxiServiceTypes),
    settings,
  };
}

function distanceKmField(formData: FormData, key: string) {
  const raw = stringField(formData, key);
  if (!raw) return 0;

  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function optionalStringFromValue(value: FormDataEntryValue | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
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

function parseReservationPeriod(formData: FormData): { startsAt: Date | null; endsAt: Date | null } {
  const visitRaw = stringField(formData, "visitDate");
  if (visitRaw) {
    const visit = parseDateOnly(visitRaw);
    if (!visit) return { startsAt: null, endsAt: null };
    return { startsAt: visit, endsAt: addDays(visit, 1) };
  }
  const start = parseDateOnly(formData.get("startsAt"));
  const end = parseDateOnly(formData.get("endsAt"));
  if (!start || !end) return { startsAt: null, endsAt: null };
  return { startsAt: start, endsAt: end };
}

export async function createReservationAction(formData: FormData) {
  await requireUser();
  const tutorId = stringField(formData, "tutorId");
  const serviceTypeId = stringField(formData, "serviceTypeId");
  const priceRuleId = stringField(formData, "priceRuleId");
  const petIds = Array.from(new Set(selectedValues(formData, "petIds")));
  const { startsAt, endsAt } = parseReservationPeriod(formData);

  if (!tutorId || (!serviceTypeId && !priceRuleId) || !petIds.length || !startsAt || !endsAt) {
    redirect("/nova-reserva?error=dados-obrigatorios");
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
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

  const pickupMode = stringField(formData, "pickupMode") === "ZENI_PICKUP"
    ? "ZENI_PICKUP"
    : "TUTOR_DROPS_OFF";
  const base = await calculateBaseAmount({
    serviceTypeId,
    priceRuleId,
    petCount: petIds.length,
    startsAt,
    endsAt,
  });
  if (!base.ok) redirect(`/nova-reserva?error=${base.reason}`);

  const distanceKm = distanceKmField(formData, "distanceKm");
  if (distanceKm == null) {
    redirect("/nova-reserva?error=distancia-invalida");
  }

  const taxiPetCents = calculateTaxiPetCents({
    pickupMode,
    fixedFeeCents: base.taxiRule?.fixedFeeCents ?? 0,
    perKmCents: base.taxiRule?.perKmCents ?? 0,
    hygieneFeeCents: base.taxiRule?.hygieneFeeCents ?? 0,
    distanceKm,
  });

  const pricingMode = stringField(formData, "pricingMode");
  const manualDailyRaw = stringField(formData, "manualDailyAmountCents") || stringField(formData, "baseAmountCents");
  const useManualPricing = pricingMode === "manual" || (!pricingMode && Boolean(manualDailyRaw));
  const manualDailyCents = manualDailyRaw ? centsFieldStrict(formData, "manualDailyAmountCents") ?? centsFieldStrict(formData, "baseAmountCents") : null;
  const baseAmountCents = useManualPricing
    ? manualDailyCents == null
      ? null
      : calculateManualDailyBaseCents(manualDailyCents, base.chargeableUnits)
    : base.baseAmountCents;
  if (baseAmountCents == null) {
    redirect("/nova-reserva?error=valor-diaria-manual-invalido");
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

  const reservation = await getPrisma().$transaction(async (tx) => {
    const created = await tx.reservation.create({
      data: {
        tutorId,
        serviceTypeId: base.serviceTypeId,
        priceRuleId: base.priceRule.id,
        pricingPaymentMethod: base.pricingPaymentMethod,
        status: initialStatus,
        paymentStatus: "PENDING",
        pickupMode,
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
          create: petIds.map((petId, index) => ({
            petId,
            priceRole: index === 0 ? "first_pet" : "additional_pet",
          })),
        },
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
  const { startsAt, endsAt } = parseReservationPeriod(formData);

  if (!tutorId || (!serviceTypeId && !priceRuleId) || !petIds.length || !startsAt || !endsAt) {
    redirect(`/reservas/${id}/editar?error=dados-obrigatorios`);
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    redirect(`/reservas/${id}/editar?error=datas-invalidas`);
  }

  const pets = await getPrisma().pet.findMany({
    where: { id: { in: petIds } },
    select: { id: true, tutorId: true },
  });
  if (pets.length !== petIds.length || pets.some((pet) => pet.tutorId !== tutorId)) {
    redirect(`/reservas/${id}/editar?error=pets-do-tutor`);
  }

  const pickupMode = stringField(formData, "pickupMode") === "ZENI_PICKUP" ? "ZENI_PICKUP" : "TUTOR_DROPS_OFF";
  const base = await calculateBaseAmount({
    serviceTypeId,
    priceRuleId,
    petCount: petIds.length,
    startsAt,
    endsAt,
  });
  if (!base.ok) redirect(`/reservas/${id}/editar?error=${base.reason}`);

  const distanceKm = distanceKmField(formData, "distanceKm");
  if (distanceKm == null) {
    redirect(`/reservas/${id}/editar?error=distancia-invalida`);
  }

  const taxiPetCents = calculateTaxiPetCents({
    pickupMode,
    fixedFeeCents: base.taxiRule?.fixedFeeCents ?? 0,
    perKmCents: base.taxiRule?.perKmCents ?? 0,
    hygieneFeeCents: base.taxiRule?.hygieneFeeCents ?? 0,
    distanceKm,
  });

  const pricingMode = stringField(formData, "pricingMode");
  const manualDailyRaw = stringField(formData, "manualDailyAmountCents") || stringField(formData, "baseAmountCents");
  const useManualPricing = pricingMode === "manual" || (!pricingMode && Boolean(manualDailyRaw));
  const manualDailyCents = manualDailyRaw
    ? centsFieldStrict(formData, "manualDailyAmountCents") ?? centsFieldStrict(formData, "baseAmountCents")
    : null;
  const baseAmountCents = useManualPricing
    ? manualDailyCents == null
      ? null
      : calculateManualDailyBaseCents(manualDailyCents, base.chargeableUnits)
    : base.baseAmountCents;
  if (baseAmountCents == null) {
    redirect(`/reservas/${id}/editar?error=valor-diaria-manual-invalido`);
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

  await getPrisma().$transaction(async (tx) => {
    await tx.reservation.update({
      where: { id },
      data: {
        tutorId,
        serviceTypeId: base.serviceTypeId,
        priceRuleId: base.priceRule.id,
        pricingPaymentMethod: base.pricingPaymentMethod,
        pickupMode,
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
    // Reassign priceRole based on the new selection order so the first pet is always "first_pet".
    for (let index = 0; index < petIds.length; index++) {
      await tx.reservationPet.updateMany({
        where: { reservationId: id, petId: petIds[index] },
        data: { priceRole: index === 0 ? "first_pet" : "additional_pet" },
      });
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
        title: `${reservation.serviceType.name} - ${reservation.reservationPets.map((item) => item.pet.name).join(", ")}`,
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
