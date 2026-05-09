"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { optionalStringField, stringField } from "@/lib/forms";

function parseBirthDate(value: FormDataEntryValue | null): Date | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const date = new Date(`${text}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createTutorAction(formData: FormData) {
  const name = stringField(formData, "name");
  if (!name) redirect("/tutores?error=nome-obrigatorio");

  const tutor = await getPrisma().tutor.create({
    data: {
      name,
      phone: optionalStringField(formData, "phone"),
      email: optionalStringField(formData, "email"),
      document: optionalStringField(formData, "document"),
      address: optionalStringField(formData, "address"),
      cep: optionalStringField(formData, "cep"),
      birthDate: parseBirthDate(formData.get("birthDate")),
      notes: optionalStringField(formData, "notes"),
    },
  });

  revalidatePath("/tutores");
  redirect(`/tutores/${tutor.id}/ficha`);
}

export async function updateTutorAction(id: string, formData: FormData) {
  const name = stringField(formData, "name");
  if (!name) redirect(`/tutores/${id}/ficha?error=nome-obrigatorio`);

  await getPrisma().tutor.update({
    where: { id },
    data: {
      name,
      phone: optionalStringField(formData, "phone"),
      email: optionalStringField(formData, "email"),
      document: optionalStringField(formData, "document"),
      address: optionalStringField(formData, "address"),
      cep: optionalStringField(formData, "cep"),
      birthDate: parseBirthDate(formData.get("birthDate")),
      notes: optionalStringField(formData, "notes"),
    },
  });

  revalidatePath("/tutores");
  revalidatePath(`/tutores/${id}`);
  revalidatePath(`/tutores/${id}/ficha`);
  redirect(`/tutores/${id}/ficha?saved=1`);
}

export async function toggleTutorStatusAction(id: string, status: "ACTIVE" | "INACTIVE") {
  await getPrisma().tutor.update({
    where: { id },
    data: { status: status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });

  revalidatePath("/tutores");
  revalidatePath(`/tutores/${id}`);
  revalidatePath(`/tutores/${id}/ficha`);
}

export async function deleteTutorAction(id: string) {
  const reservationCount = await getPrisma().reservation.count({ where: { tutorId: id } });
  if (reservationCount > 0) {
    redirect(`/tutores/${id}/ficha?error=tutor-com-reservas`);
  }

  // Schema cascades pets and tasks; reservations would block (we already rejected above).
  await getPrisma().tutor.delete({ where: { id } });

  revalidatePath("/tutores");
  redirect("/tutores?deleted=1");
}
