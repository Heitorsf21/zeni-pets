"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { GoogleCalendarConnection } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { centsField, intField, optionalStringField, stringField } from "@/lib/forms";
import { formatPetServiceTitle } from "@/lib/reservation-title";
import {
  createCalendarWatch,
  encryptGoogleChannelToken,
  listChangedEvents,
  revokeGoogleTokens,
  stopCalendarWatch,
  upsertReservationEvent,
  updateGoogleEventTitle,
} from "@/lib/google/calendar";

type SelectedGoogleConnection = GoogleCalendarConnection & { googleCalendarId: string };

export async function updateBusinessSettingsAction(formData: FormData) {
  await requireUser();
  await getPrisma().businessSettings.upsert({
    where: { singletonKey: "default" },
    update: {
      businessName: stringField(formData, "businessName") || "Zeni Pets",
      ownerName: stringField(formData, "ownerName") || "Fernanda Zeni",
      phone: optionalStringField(formData, "phone"),
      instagram: optionalStringField(formData, "instagram"),
      address: optionalStringField(formData, "address"),
      boardingCapacity: intField(formData, "boardingCapacity", 12),
      daycareCapacity: intField(formData, "daycareCapacity", 8),
      defaultCheckInTime: stringField(formData, "defaultCheckInTime") || "10:00",
      defaultCheckOutTime: stringField(formData, "defaultCheckOutTime") || "18:00",
      lateFeeOnePetCents: centsField(formData, "lateFeeOnePetCents", 1000),
      lateFeeManyPetsCents: centsField(formData, "lateFeeManyPetsCents", 1500),
      depositPercent: intField(formData, "depositPercent", 50),
    },
    create: {
      singletonKey: "default",
      businessName: stringField(formData, "businessName") || "Zeni Pets",
      ownerName: stringField(formData, "ownerName") || "Fernanda Zeni",
      phone: optionalStringField(formData, "phone"),
      instagram: optionalStringField(formData, "instagram"),
      address: optionalStringField(formData, "address"),
      boardingCapacity: intField(formData, "boardingCapacity", 12),
      daycareCapacity: intField(formData, "daycareCapacity", 8),
      defaultCheckInTime: stringField(formData, "defaultCheckInTime") || "10:00",
      defaultCheckOutTime: stringField(formData, "defaultCheckOutTime") || "18:00",
      lateFeeOnePetCents: centsField(formData, "lateFeeOnePetCents", 1000),
      lateFeeManyPetsCents: centsField(formData, "lateFeeManyPetsCents", 1500),
      depositPercent: intField(formData, "depositPercent", 50),
    },
  });

  revalidatePath("/configuracoes");
  redirect("/configuracoes?saved=1");
}

export async function saveGoogleCalendarAction(formData: FormData) {
  await requireUser();
  const googleCalendarId = stringField(formData, "googleCalendarId");
  if (!googleCalendarId) redirect("/configuracoes?error=calendario-obrigatorio");

  const connection = await getPrisma().googleCalendarConnection.findFirst({
    orderBy: { connectedAt: "desc" },
  });
  if (!connection) redirect("/configuracoes?error=google-nao-conectado");

  const prisma = getPrisma();
  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: { googleCalendarId, googleSyncToken: null },
  });

  const selectedConnection = { ...connection, googleCalendarId } satisfies SelectedGoogleConnection;
  const changes = await listChangedEvents({
    tokens: selectedConnection,
    calendarId: googleCalendarId,
    syncToken: null,
  });
  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      googleSyncToken: changes.nextSyncToken,
      lastSyncedAt: new Date(),
    },
  });

  await syncFutureReservationsToGoogle(prisma, selectedConnection);
  await replaceGoogleCalendarWatch(prisma, selectedConnection).catch(() => undefined);

  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  redirect("/configuracoes?google=calendar-saved");
}

export async function syncFutureReservationsToGoogleAction() {
  await requireUser();
  const prisma = getPrisma();
  const connection = await prisma.googleCalendarConnection.findFirst({
    where: { googleCalendarId: { not: null } },
    orderBy: { connectedAt: "desc" },
  });
  if (!connection?.googleCalendarId) redirect("/configuracoes?error=calendario-obrigatorio");
  const selectedConnection = {
    ...connection,
    googleCalendarId: connection.googleCalendarId,
  } satisfies SelectedGoogleConnection;

  const { synced, failed } = await syncFutureReservationsToGoogle(prisma, selectedConnection);

  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date() },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  redirect(`/configuracoes?google=sync-complete&synced=${synced}&failed=${failed}`);
}

export async function updateGoogleEventTitlesAction() {
  await requireUser();
  const prisma = getPrisma();
  const connection = await prisma.googleCalendarConnection.findFirst({
    where: { googleCalendarId: { not: null } },
    orderBy: { connectedAt: "desc" },
  });
  if (!connection?.googleCalendarId) redirect("/configuracoes?error=calendario-obrigatorio");

  const reservations = await prisma.reservation.findMany({
    where: {
      googleEventId: { not: null },
      googleCalendarId: { not: null },
    },
    include: {
      serviceType: true,
      reservationPets: { include: { pet: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  let synced = 0;
  let failed = 0;
  for (const reservation of reservations) {
    if (!reservation.googleEventId || !reservation.googleCalendarId) continue;

    try {
      const event = await updateGoogleEventTitle({
        tokens: connection,
        calendarId: reservation.googleCalendarId,
        googleEventId: reservation.googleEventId,
        title: formatPetServiceTitle({
          petNames: reservation.reservationPets.map((item) => item.pet.name),
          serviceName: reservation.serviceType.name,
        }),
      });
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          googleEventEtag: event.etag ?? reservation.googleEventEtag,
          googleLastSyncedAt: new Date(),
          syncConflict: false,
          syncConflictReason: null,
        },
      });
      synced++;
    } catch (error) {
      failed++;
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          syncConflict: true,
          syncConflictReason: error instanceof Error ? error.message : "Falha ao atualizar nome do evento no Google Agenda",
        },
      });
    }
  }

  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: { lastSyncedAt: new Date() },
  });

  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  redirect(`/configuracoes?google=title-sync-complete&synced=${synced}&failed=${failed}`);
}

export async function reactivateGoogleWebhookAction() {
  await requireUser();
  const prisma = getPrisma();
  const connection = await prisma.googleCalendarConnection.findFirst({
    where: { googleCalendarId: { not: null } },
    orderBy: { connectedAt: "desc" },
  });
  if (!connection?.googleCalendarId) redirect("/configuracoes?error=calendario-obrigatorio");
  if (!process.env.GOOGLE_WEBHOOK_URL) {
    redirect("/configuracoes?error=GOOGLE_WEBHOOK_URL-nao-configurado");
  }
  const selectedConnection = {
    ...connection,
    googleCalendarId: connection.googleCalendarId,
  } satisfies SelectedGoogleConnection;

  try {
    await replaceGoogleCalendarWatch(prisma, selectedConnection);
  } catch (error) {
    redirect(`/configuracoes?error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao ativar webhook")}`);
  }

  revalidatePath("/configuracoes");
  redirect("/configuracoes?google=webhook-reactivated");
}

export async function disconnectGoogleCalendarAction() {
  await requireUser();
  const prisma = getPrisma();
  const connection = await prisma.googleCalendarConnection.findFirst({
    orderBy: { connectedAt: "desc" },
  });
  if (!connection) redirect("/configuracoes?error=google-nao-conectado");

  await stopCalendarWatch({
    tokens: connection,
    channelId: connection.googleChannelId,
    resourceId: connection.googleResourceId,
  }).catch(() => undefined);
  await revokeGoogleTokens(connection).catch(() => undefined);
  await prisma.googleCalendarConnection.delete({ where: { id: connection.id } });

  revalidatePath("/configuracoes");
  redirect("/configuracoes?google=disconnected");
}

async function syncFutureReservationsToGoogle(
  prisma: ReturnType<typeof getPrisma>,
  connection: SelectedGoogleConnection,
) {
  const reservations = await prisma.reservation.findMany({
    where: {
      status: { in: ["REQUESTED", "CONFIRMED", "IN_PROGRESS"] },
      endsAt: { gte: new Date() },
    },
    include: {
      tutor: true,
      serviceType: true,
      reservationPets: { include: { pet: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  let synced = 0;
  let failed = 0;
  for (const reservation of reservations) {
    try {
      const event = await upsertReservationEvent({
        tokens: connection,
        calendarId: connection.googleCalendarId,
        googleEventId: reservation.googleEventId,
        reservation: {
          reservationId: reservation.id,
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
        where: { id: reservation.id },
        data: {
          googleCalendarId: connection.googleCalendarId,
          googleEventId: event.id ?? reservation.googleEventId,
          googleEventEtag: event.etag ?? reservation.googleEventEtag,
          googleLastSyncedAt: new Date(),
          syncConflict: false,
          syncConflictReason: null,
        },
      });
      synced++;
    } catch (error) {
      failed++;
      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          syncConflict: true,
          syncConflictReason: error instanceof Error ? error.message : "Falha ao sincronizar com Google Agenda",
        },
      });
    }
  }

  return { synced, failed };
}

async function replaceGoogleCalendarWatch(
  prisma: ReturnType<typeof getPrisma>,
  connection: SelectedGoogleConnection,
) {
  if (!process.env.GOOGLE_WEBHOOK_URL) return;

  await stopCalendarWatch({
    tokens: connection,
    channelId: connection.googleChannelId,
    resourceId: connection.googleResourceId,
  }).catch(() => undefined);

  const watch = await createCalendarWatch({
    tokens: connection,
    calendarId: connection.googleCalendarId,
  });

  await prisma.googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      googleChannelId: watch.id ?? null,
      googleChannelTokenCipher: encryptGoogleChannelToken(watch.channelToken),
      googleResourceId: watch.resourceId ?? null,
      googleChannelExpiresAt: watch.expiration ? new Date(Number(watch.expiration)) : null,
    },
  });
}
