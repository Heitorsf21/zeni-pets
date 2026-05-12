import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "zeni_session";
export const GOOGLE_OAUTH_STATE_COOKIE = "zeni_google_oauth_state";

function getAuthSecret() {
  return process.env.AUTH_SECRET || "dev-change-me-before-production";
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("hex");
}

export function createSessionToken(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ userId, createdAt: Date.now() }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.byteLength !== b.byteLength || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof parsed.userId === "string" ? parsed.userId : null;
  } catch {
    return null;
  }
}

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionUserId() {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireUser() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return userId;
}

export async function createGoogleOAuthState() {
  const jar = await cookies();
  const state = randomBytes(32).toString("base64url");
  jar.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  return state;
}

export async function consumeGoogleOAuthState(expectedState: string | null) {
  const jar = await cookies();
  const storedState = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? null;
  jar.delete(GOOGLE_OAUTH_STATE_COOKIE);
  return Boolean(
    expectedState &&
      storedState &&
      expectedState.length === storedState.length &&
      timingSafeEqual(Buffer.from(expectedState), Buffer.from(storedState)),
  );
}
