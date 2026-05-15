import { timingSafeEqual } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(providedToken: string | null) {
  const expectedToken = process.env.ADMIN_ROTATION_TOKEN;
  if (!expectedToken || !providedToken) return false;

  const provided = Buffer.from(providedToken);
  const expected = Buffer.from(expectedToken);
  return provided.byteLength === expected.byteLength && timingSafeEqual(provided, expected);
}

export async function POST(request: Request) {
  if (!isAuthorized(request.headers.get("x-admin-rotation-token"))) {
    return Response.json({ ok: false }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminUsername || !adminPassword) {
    return Response.json(
      { ok: false, error: "Missing admin environment variables." },
      { status: 500 },
    );
  }

  const user = await getPrisma().user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Fernanda Zeni",
      username: adminUsername,
      passwordHash: hashPassword(adminPassword),
    },
    create: {
      name: "Fernanda Zeni",
      email: adminEmail,
      username: adminUsername,
      passwordHash: hashPassword(adminPassword),
      role: "OWNER",
    },
    select: {
      email: true,
      username: true,
      updatedAt: true,
    },
  });

  return Response.json({ ok: true, user });
}
