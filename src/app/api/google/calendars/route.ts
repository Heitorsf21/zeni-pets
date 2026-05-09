import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { listGoogleCalendars } from "@/lib/google/calendar";

export async function GET() {
  const connection = await getPrisma().googleCalendarConnection.findFirst({
    orderBy: { connectedAt: "desc" },
  });

  if (!connection) {
    return NextResponse.json({ calendars: [], connected: false });
  }

  try {
    const calendars = await listGoogleCalendars(connection);
    return NextResponse.json({
      calendars: calendars.map((calendar) => ({
        id: calendar.id,
        summary: calendar.summary,
        primary: Boolean(calendar.primary),
        accessRole: calendar.accessRole,
      })),
      connected: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        calendars: [],
        connected: true,
        error: error instanceof Error ? error.message : "Falha ao listar calendarios",
      },
      { status: 502 },
    );
  }
}
