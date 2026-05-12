import { NextRequest, NextResponse } from "next/server";
import { consumeGoogleOAuthState, getSessionUserId } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { exchangeGoogleCode, getGoogleAccountEmail, serializeTokens } from "@/lib/google/calendar";

export async function GET(request: NextRequest) {
  if (!(await getSessionUserId())) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = request.nextUrl.searchParams.get("state");
  if (!(await consumeGoogleOAuthState(state))) {
    return NextResponse.redirect(new URL("/configuracoes?google=invalid-state", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/configuracoes?google=missing-code", request.url));
  }

  const tokens = await exchangeGoogleCode(code);
  const serialized = serializeTokens(tokens);
  const providerAccountEmail = await getGoogleAccountEmail(tokens).catch(() => null);

  await getPrisma().googleCalendarConnection.upsert({
    where: { id: "default-google" },
    update: {
      providerAccountEmail,
      accessTokenCipher: serialized.accessTokenCipher,
      refreshTokenCipher: serialized.refreshTokenCipher ?? undefined,
      scopes: serialized.scopes,
    },
    create: {
      id: "default-google",
      providerAccountEmail,
      accessTokenCipher: serialized.accessTokenCipher,
      refreshTokenCipher: serialized.refreshTokenCipher,
      scopes: serialized.scopes,
    },
  });

  return NextResponse.redirect(new URL("/configuracoes?google=connected", request.url));
}
