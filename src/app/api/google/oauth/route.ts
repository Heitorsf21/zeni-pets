import { NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/google/calendar";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
    return NextResponse.json(
      { error: "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI para conectar o Google Agenda." },
      { status: 503 },
    );
  }

  return NextResponse.redirect(getGoogleAuthUrl());
}
