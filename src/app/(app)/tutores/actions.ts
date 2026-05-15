"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { centsFieldStrict, optionalStringField, stringField } from "@/lib/forms";
import { getTutorCreditBalance } from "@/lib/credits";

function parseBirthDate(value: FormDataEntryValue | null): Date | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const parts = text.split("-").map(Number);
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  if (!year || !month || !day) return null;
  const currentYear = new Date().getFullYear();
  if (year < 1900 || year > currentYear) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createTutorAction(formData: FormData) {
  await requireUser();
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
  await requireUser();
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
  await requireUser();
  await getPrisma().tutor.update({
    where: { id },
    data: { status: status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
  });

  revalidatePath("/tutores");
  revalidatePath(`/tutores/${id}`);
  revalidatePath(`/tutores/${id}/ficha`);
}

export async function adjustTutorCreditAction(id: string, formData: FormData) {
  await requireUser();
  const amountCents = centsFieldStrict(formData, "amountCents");
  const operation = stringField(formData, "operation") === "REMOVE" ? "REMOVE" : "ADD";
  const description = optionalStringField(formData, "description")
    ?? (operation === "ADD" ? "Crédito adicionado manualmente" : "Ajuste manual de crédito");

  if (amountCents == null || amountCents <= 0) {
    redirect(`/tutores/${id}/ficha?error=valor-invalido`);
  }

  const prisma = getPrisma();
  const tutor = await prisma.tutor.findUnique({ where: { id }, select: { id: true } });
  if (!tutor) redirect("/tutores?error=tutor-nao-encontrado");

  const balance = await getTutorCreditBalance(prisma, id);
  if (operation === "REMOVE" && amountCents > balance) {
    redirect(`/tutores/${id}/ficha?error=credito-insuficiente`);
  }

  await prisma.tutorCreditTransaction.create({
    data: {
      tutorId: id,
      type: operation === "ADD" ? "CREDIT_ADDED" : "ADJUSTMENT",
      amountCents: operation === "ADD" ? amountCents : -amountCents,
      description,
      entryDate: new Date(),
    },
  });

  revalidatePath("/tutores");
  revalidatePath(`/tutores/${id}`);
  revalidatePath(`/tutores/${id}/ficha`);
  revalidatePath("/financeiro");
  redirect(`/tutores/${id}/ficha?saved=credit`);
}

export async function deleteTutorAction(id: string) {
  await requireUser();
  const reservationCount = await getPrisma().reservation.count({ where: { tutorId: id } });
  if (reservationCount > 0) {
    redirect(`/tutores/${id}/ficha?error=tutor-com-reservas`);
  }

  // Schema cascades pets and tasks; reservations would block (we already rejected above).
  await getPrisma().tutor.delete({ where: { id } });

  revalidatePath("/tutores");
  redirect("/tutores?deleted=1");
}
