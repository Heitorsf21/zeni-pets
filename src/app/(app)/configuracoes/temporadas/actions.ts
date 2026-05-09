"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { optionalStringField, stringField } from "@/lib/forms";
import { parseDatetimeLocal } from "@/lib/date";

function parseDateOrNull(value: FormDataEntryValue | null) {
  if (!value) return null;
  const text = String(value);
  if (!text) return null;
  // Accept either "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm".
  const date = text.includes("T") ? parseDatetimeLocal(text) : new Date(`${text}T00:00:00`);
  if (!date || Number.isNaN(date.getTime())) return null;
  return date;
}

export async function createSeasonAction(formData: FormData) {
  const name = stringField(formData, "name");
  const startsAt = parseDateOrNull(formData.get("startsAt"));
  const endsAt = parseDateOrNull(formData.get("endsAt"));
  if (!name || !startsAt || !endsAt) redirect("/configuracoes/temporadas?error=dados-invalidos");
  if (endsAt.getTime() <= startsAt.getTime()) {
    redirect("/configuracoes/temporadas?error=datas-invalidas");
  }

  await getPrisma().seasonPeriod.create({
    data: {
      name,
      startsAt,
      endsAt,
      notes: optionalStringField(formData, "notes"),
      isActive: formData.get("isActive") !== "off",
    },
  });

  revalidatePath("/configuracoes/temporadas");
  redirect("/configuracoes/temporadas?saved=1");
}

export async function updateSeasonAction(id: string, formData: FormData) {
  const name = stringField(formData, "name");
  const startsAt = parseDateOrNull(formData.get("startsAt"));
  const endsAt = parseDateOrNull(formData.get("endsAt"));
  if (!name || !startsAt || !endsAt) redirect("/configuracoes/temporadas?error=dados-invalidos");
  if (endsAt.getTime() <= startsAt.getTime()) {
    redirect("/configuracoes/temporadas?error=datas-invalidas");
  }

  await getPrisma().seasonPeriod.update({
    where: { id },
    data: {
      name,
      startsAt,
      endsAt,
      notes: optionalStringField(formData, "notes"),
      isActive: formData.get("isActive") !== "off",
    },
  });

  revalidatePath("/configuracoes/temporadas");
  redirect("/configuracoes/temporadas?saved=1");
}

export async function deleteSeasonAction(id: string) {
  await getPrisma().seasonPeriod.delete({ where: { id } });
  revalidatePath("/configuracoes/temporadas");
  redirect("/configuracoes/temporadas?deleted=1");
}
