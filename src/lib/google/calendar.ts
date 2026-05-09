import { randomUUID } from "node:crypto";
import { google } from "googleapis";
import { decryptText, encryptText } from "@/lib/crypto";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export type CalendarTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
  token_type?: string | null;
};

export type ReservationCalendarEventInput = {
  reservationId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  tutorEmail?: string | null;
  inviteTutor?: boolean;
  notes?: string | null;
};

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function getGoogleEnvStatus() {
  return {
    clientId: Boolean(process.env.GOOGLE_CLIENT_ID),
    clientSecret: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    redirectUri: Boolean(process.env.GOOGLE_REDIRECT_URI),
    webhookUrl: Boolean(process.env.GOOGLE_WEBHOOK_URL),
  };
}

export function assertGoogleOAuthEnv() {
  const status = getGoogleEnvStatus();
  const missing = [
    status.clientId ? null : "GOOGLE_CLIENT_ID",
    status.clientSecret ? null : "GOOGLE_CLIENT_SECRET",
    status.redirectUri ? null : "GOOGLE_REDIRECT_URI",
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(`Configure ${missing.join(", ")} para conectar o Google Agenda.`);
  }
}

export function getGoogleAuthUrl() {
  assertGoogleOAuthEnv();
  return getOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });
}

export async function exchangeGoogleCode(code: string) {
  assertGoogleOAuthEnv();
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens as CalendarTokens;
}

export async function getGoogleAccountEmail(tokens: CalendarTokens) {
  const client = getOAuthClient();
  client.setCredentials({
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
    scope: tokens.scope ?? undefined,
    token_type: tokens.token_type ?? undefined,
  });
  const oauth = google.oauth2({ version: "v2", auth: client });
  const response = await oauth.userinfo.get();
  return response.data.email ?? null;
}

export function serializeTokens(tokens: CalendarTokens) {
  return {
    accessTokenCipher: tokens.access_token ? encryptText(tokens.access_token) : null,
    refreshTokenCipher: tokens.refresh_token ? encryptText(tokens.refresh_token) : null,
    scopes: tokens.scope ?? GOOGLE_SCOPES.join(" "),
  };
}

function clientFromStoredTokens(input: {
  accessTokenCipher?: string | null;
  refreshTokenCipher?: string | null;
}) {
  const client = getOAuthClient();
  client.setCredentials({
    access_token: decryptText(input.accessTokenCipher),
    refresh_token: decryptText(input.refreshTokenCipher),
  });
  return client;
}

export function reservationToGoogleEvent(input: ReservationCalendarEventInput) {
  return {
    summary: input.title,
    description: input.notes ?? undefined,
    start: { dateTime: input.startsAt.toISOString() },
    end: { dateTime: input.endsAt.toISOString() },
    attendees:
      input.inviteTutor && input.tutorEmail ? [{ email: input.tutorEmail }] : undefined,
    extendedProperties: {
      private: {
        zeniReservationId: input.reservationId,
      },
    },
  };
}

export async function listGoogleCalendars(tokens: {
  accessTokenCipher?: string | null;
  refreshTokenCipher?: string | null;
}) {
  const calendar = google.calendar({
    version: "v3",
    auth: clientFromStoredTokens(tokens),
  });
  const response = await calendar.calendarList.list();
  return response.data.items ?? [];
}

export async function revokeGoogleTokens(tokens: {
  accessTokenCipher?: string | null;
  refreshTokenCipher?: string | null;
}) {
  const client = clientFromStoredTokens(tokens);
  const token = decryptText(tokens.refreshTokenCipher) ?? decryptText(tokens.accessTokenCipher);
  if (!token) return;
  await client.revokeToken(token);
}

export async function upsertReservationEvent(input: {
  tokens: { accessTokenCipher?: string | null; refreshTokenCipher?: string | null };
  calendarId: string;
  googleEventId?: string | null;
  reservation: ReservationCalendarEventInput;
}) {
  const calendar = google.calendar({
    version: "v3",
    auth: clientFromStoredTokens(input.tokens),
  });
  const requestBody = reservationToGoogleEvent(input.reservation);
  const sendUpdates = input.reservation.inviteTutor ? "all" : "none";

  if (input.googleEventId) {
    const response = await calendar.events.patch({
      calendarId: input.calendarId,
      eventId: input.googleEventId,
      requestBody,
      sendUpdates,
    });
    return response.data;
  }

  const response = await calendar.events.insert({
    calendarId: input.calendarId,
    requestBody,
    sendUpdates,
  });
  return response.data;
}

export async function cancelReservationEvent(input: {
  tokens: { accessTokenCipher?: string | null; refreshTokenCipher?: string | null };
  calendarId: string;
  googleEventId: string;
}) {
  const calendar = google.calendar({
    version: "v3",
    auth: clientFromStoredTokens(input.tokens),
  });
  await calendar.events.delete({
    calendarId: input.calendarId,
    eventId: input.googleEventId,
    sendUpdates: "none",
  });
}

export async function createCalendarWatch(input: {
  tokens: { accessTokenCipher?: string | null; refreshTokenCipher?: string | null };
  calendarId: string;
}) {
  if (!process.env.GOOGLE_WEBHOOK_URL) {
    throw new Error("GOOGLE_WEBHOOK_URL is required for Calendar push notifications.");
  }

  const calendar = google.calendar({
    version: "v3",
    auth: clientFromStoredTokens(input.tokens),
  });
  const response = await calendar.events.watch({
    calendarId: input.calendarId,
    requestBody: {
      id: randomUUID(),
      type: "web_hook",
      address: process.env.GOOGLE_WEBHOOK_URL,
    },
  });
  return response.data;
}

export async function listChangedEvents(input: {
  tokens: { accessTokenCipher?: string | null; refreshTokenCipher?: string | null };
  calendarId: string;
  syncToken?: string | null;
}) {
  const calendar = google.calendar({
    version: "v3",
    auth: clientFromStoredTokens(input.tokens),
  });
  const response = await calendar.events.list({
    calendarId: input.calendarId,
    syncToken: input.syncToken ?? undefined,
    singleEvents: true,
    showDeleted: true,
  });

  return {
    events: response.data.items ?? [],
    nextSyncToken: response.data.nextSyncToken ?? null,
  };
}
