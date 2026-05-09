"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPrisma } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { parseFormData } from "@/lib/validation";

const LoginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function loginAction(formData: FormData) {
  const parsed = parseFormData(formData, LoginSchema);
  if (!parsed.success) redirect("/login?error=1");

  const identifier = parsed.data.identifier;
  const lookup = identifier.includes("@")
    ? { email: identifier.toLowerCase() }
    : { username: identifier };

  let isValid = false;
  let userId = "";

  try {
    const user = await getPrisma().user.findUnique({ where: lookup });
    if (user && verifyPassword(parsed.data.password, user.passwordHash)) {
      isValid = true;
      userId = user.id;
    }
  } catch (error) {
    console.error("Login failed because the database is unavailable.", error);
    isValid = false;
  }

  if (!isValid) redirect("/login?error=1");

  await setSession(userId);
  redirect("/dashboard");
}
