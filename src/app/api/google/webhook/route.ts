import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { listChangedEvents } from "@/lib/google/calendar";

export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceId = request.headers.get("x-goog-resource-id");

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

  const changes = await listChangedEvents({
    tokens: connection,
    calendarId: connection.googleCalendarId,
    syncToken: connection.googleSyncToken,
  });

  for (const event of changes.events) {
    const reservationId = event.extendedProperties?.private?.zeniReservationId;
    if (!reservationId) continue;

    const startsAt = event.start?.dateTime ? new Date(event.start.dateTime) : null;
    const endsAt = event.end?.dateTime ? new Date(event.end.dateTime) : null;

    await getPrisma().reservation.update({
      where: { id: reservationId },
      data: {
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(event.status === "cancelled" ? { status: "CANCELLED" } : {}),
        googleEventEtag: event.etag ?? undefined,
        googleLastSyncedAt: new Date(),
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

  return NextResponse.json({ ok: true, changed: changes.events.length });
}
