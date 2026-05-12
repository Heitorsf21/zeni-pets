import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import {
  GoogleSyncTokenExpiredError,
  listChangedEvents,
  verifyGoogleChannelToken,
} from "@/lib/google/calendar";

export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceId = request.headers.get("x-goog-resource-id");
  const channelToken = request.headers.get("x-goog-channel-token");

  const connection = await getPrisma().googleCalendarConnection.findFirst({
    where: {
      googleChannelId: channelId ?? undefined,
      googleResourceId: resourceId ?? undefined,
    },
    orderBy: { connectedAt: "desc" },
  });

  if (!connection?.googleCalendarId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!verifyGoogleChannelToken({
    googleChannelTokenCipher: connection.googleChannelTokenCipher,
    headerToken: channelToken,
  })) {
    return NextResponse.json({ ok: false, error: "Canal Google inválido" }, { status: 401 });
  }

  let fullResync = false;
  let changes;
  try {
    changes = await listChangedEvents({
      tokens: connection,
      calendarId: connection.googleCalendarId,
      syncToken: connection.googleSyncToken,
    });
  } catch (error) {
    if (!(error instanceof GoogleSyncTokenExpiredError)) throw error;
    fullResync = true;
    changes = await listChangedEvents({
      tokens: connection,
      calendarId: connection.googleCalendarId,
      syncToken: null,
    });
  }

  for (const event of changes.events) {
    const reservationId = event.extendedProperties?.private?.zeniReservationId;
    if (!reservationId) continue;

    const startsAt = event.start?.dateTime ? new Date(event.start.dateTime) : null;
    const endsAt = event.end?.dateTime ? new Date(event.end.dateTime) : null;

    await getPrisma().reservation.updateMany({
      where: { id: reservationId },
      data: {
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(event.status === "cancelled" ? { status: "CANCELLED", paymentStatus: "CANCELLED" } : {}),
        googleEventEtag: event.etag ?? undefined,
        googleLastSyncedAt: new Date(),
        syncConflict: false,
        syncConflictReason: null,
      },
    });
  }

  await getPrisma().googleCalendarConnection.update({
    where: { id: connection.id },
    data: {
      googleSyncToken: changes.nextSyncToken ?? connection.googleSyncToken,
      lastSyncedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, changed: changes.events.length, fullResync });
}
