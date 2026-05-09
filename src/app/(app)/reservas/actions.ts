"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { centsField, centsFieldStrict, optionalStringField, selectedValues, stringField } from "@/lib/forms";
import { parseDatetimeLocal } from "@/lib/date";
import {
  calculateLateFeeCents,
  calculateReservationTotals,
  calculateTaxiPetCents,
  isHighSeason,
} from "@/lib/rules";
import { upsertReservationEvent } from "@/lib/google/calendar";

async function calculateBaseAmount(serviceTypeId: string, petCount: number, startsAt: Date) {
  const prisma = getPrisma();
  const [serviceType, seasons, settings] = await Promise.all([
    prisma.serviceType.findUnique({
      where: { id: serviceTypeId },
      include: { priceRules: { where: { isActive: true }, take: 1 } },
    }),
    prisma.seasonPeriod.findMany({ where: { isActive: true } }),
    prisma.businessSettings.findUnique({ where: { singletonKey: "default" } }),
  ]);

  const rule = serviceType?.priceRules[0];
  if (!rule) return { baseAmountCents: 0, taxiRule: null, settings };

  const highSeason = isHighSeason(startsAt, seasons);
  const firstPet = highSeason
    ? rule.highSeasonFirstPetCents ?? rule.firstPetCents
    : rule.firstPetCents;
  const additionalPet = highSeason
    ? rule.highSeasonAdditionalCents ?? rule.additionalPetCents ?? 0
    : rule.additionalPetCents ?? 0;

  return {
    baseAmountCents: firstPet + Math.max(petCount - 1, 0) * additionalPet,
    taxiRule: rule,
    settings,
  };
}

export async function createReservationAction(formData: FormData) {
  const tutorId = stringField(formData, "tutorId");
  const serviceTypeId = stringField(formData, "serviceTypeId");
  const petIds = selectedValues(formData, "petIds");
  const startsAt = parseDatetimeLocal(formData.get("startsAt"));
  const endsAt = parseDatetimeLocal(formData.get("endsAt"));

  if (!tutorId || !serviceTypeId || !petIds.length || !startsAt || !endsAt) {
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
  const base = await calculateBaseAmount(serviceTypeId, petIds.length, startsAt);
  const taxiPetCents = calculateTaxiPetCents({
    pickupMode,
    fixedFeeCents: base.taxiRule?.fixedFeeCents ?? 0,
    perKmCents: base.taxiRule?.perKmCents ?? 0,
    hygieneFeeCents: base.taxiRule?.hygieneFeeCents ?? 0,
    distanceKm: Number(stringField(formData, "distanceKm")) || 0,
  });

  // Use strict parsing for the headline value: empty falls back to the rule price,
  // but unparseable text (e.g. user typed "abc") rejects the form instead of saving 0.
  const baseRaw = stringField(formData, "baseAmountCents");
  const baseAmountCents = baseRaw
    ? centsFieldStrict(formData, "baseAmountCents")
    : base.baseAmountCents;
  if (baseAmountCents == null) {
    redirect("/nova-reserva?error=valor-base-invalido");
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

  const reservation = await getPrisma().reservation.create({
    data: {
      tutorId,
      serviceTypeId,
      status: "CONFIRMED",
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

  await syncReservationToGoogleIfConfigured(reservation.id);

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/financeiro");
  redirect(`/reservas/${reservation.id}`);
}

export async function updateReservationStatusAction(
  id: string,
  status: "REQUESTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
) {
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
    const paid = await getPrisma().payment.aggregate({
      where: { reservationId: id, status: "PAID" },
      _sum: { amountCents: true },
    });
    const paymentStatus =
      (paid._sum.amountCents ?? 0) >= reservation.totalCents ? "PAID" : "PARTIAL";
    await getPrisma().reservation.update({
      where: { id },
      data: { paymentStatus },
    });
  }

  await syncReservationToGoogleIfConfigured(id);
  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath(`/reservas/${id}`);
}

export async function concludeWithLateFeeAction(id: string, formData: FormData) {
  const actualEndedAt = parseDatetimeLocal(formData.get("actualEndedAt")) ?? new Date();
  const reservation = await getPrisma().reservation.findUnique({
    where: { id },
    include: { reservationPets: true },
  });
  if (!reservation) redirect("/agenda?error=reserva-nao-encontrada");

  const settings = await getPrisma().businessSettings.findUnique({
    where: { singletonKey: "default" },
  });
  const lateFeeCents = calculateLateFeeCents({
    scheduledEnd: reservation.endsAt,
    actualEnd: actualEndedAt,
    petCount: reservation.reservationPets.length,
    onePetHourlyCents: settings?.lateFeeOnePetCents ?? 1000,
    manyPetsHourlyCents: settings?.lateFeeManyPetsCents ?? 1500,
  });
  const totals = calculateReservationTotals({
    baseAmountCents: reservation.baseAmountCents,
    discountCents: reservation.discountCents,
    additionalCents: reservation.additionalCents,
    taxiPetCents: reservation.taxiPetCents,
    lateFeeCents,
    depositPercent: settings?.depositPercent ?? 50,
  });

  await getPrisma().reservation.update({
    where: { id },
    data: {
      status: "COMPLETED",
      actualEndedAt,
      lateFeeCents,
      totalCents: totals.totalCents,
      depositSuggestedCents: totals.depositSuggestedCents,
      depositDueCents: totals.depositDueCents,
      balanceDueCents: totals.balanceDueCents,
      paymentStatus: "PARTIAL",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/agenda");
  revalidatePath("/financeiro");
  revalidatePath(`/reservas/${id}`);
}

export async function registerPaymentAction(id: string, formData: FormData) {
  const amountCents = centsFieldStrict(formData, "amountCents");
  if (amountCents == null || amountCents <= 0) redirect(`/reservas/${id}?error=valor-invalido`);

  const method = stringField(formData, "method") || "PIX";
  const reservation = await getPrisma().reservation.findUnique({
    where: { id },
    include: { tutor: true, serviceType: true, payments: true },
  });
  if (!reservation) redirect("/agenda?error=reserva-nao-encontrada");

  await getPrisma().payment.create({
    data: {
      reservationId: id,
      amountCents,
      method: method as "PIX" | "CASH" | "CARD" | "TRANSFER" | "OTHER",
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
      method: method as "PIX" | "CASH" | "CARD" | "TRANSFER" | "OTHER",
    },
  });

  const paid = reservation.payments.reduce((sum, payment) => sum + payment.amountCents, 0) + amountCents;
  await getPrisma().reservation.update({
    where: { id },
    data: {
      paymentStatus: paid >= reservation.totalCents ? "PAID" : "PARTIAL",
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
  revalidatePath(`/reservas/${id}`);
}

export async function deleteReservationAction(id: string) {
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
