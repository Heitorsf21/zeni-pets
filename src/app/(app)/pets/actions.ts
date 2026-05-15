"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { boolField, optionalStringField, stringField } from "@/lib/forms";
import { getPrisma } from "@/lib/db";
import { derivePetAgeFromBirthDate, normalizeAgeInput, parseAgeFromLabel } from "@/lib/pet-age";

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

function resolveAgeFields(formData: FormData): {
  birthDate: Date | null;
  ageLabel: string | null;
  ageYears: number | null;
} {
  const birthDate = parseBirthDate(formData.get("birthDate"));
  if (birthDate) {
    const derived = derivePetAgeFromBirthDate(birthDate);
    return {
      birthDate,
      ageLabel: derived?.label ?? null,
      ageYears: derived?.years ?? null,
    };
  }
  const age = normalizeAgeInput(optionalStringField(formData, "ageLabel"));
  return { birthDate: null, ageLabel: age.label, ageYears: age.years };
}

export async function createPetAction(formData: FormData) {
  await requireUser();
  const tutorId = stringField(formData, "tutorId");
  const name = stringField(formData, "name");
  if (!tutorId || !name) redirect("/pets?error=dados-obrigatorios");

  const { birthDate, ageLabel, ageYears } = resolveAgeFields(formData);
  const pet = await getPrisma().pet.create({
    data: {
      tutorId,
      name,
      species: optionalStringField(formData, "species") ?? "dog",
      breed: optionalStringField(formData, "breed"),
      birthDate,
      ageLabel,
      ageReferenceYear: ageYears != null ? new Date().getFullYear() : null,
      isNeutered: boolField(formData, "isNeutered"),
      isSociable: boolField(formData, "isSociable"),
      foodNotes: optionalStringField(formData, "foodNotes"),
      foodRestrictions: optionalStringField(formData, "foodRestrictions"),
      foodTreats: optionalStringField(formData, "foodTreats"),
      healthNotes: optionalStringField(formData, "healthNotes"),
      behaviorNotes: optionalStringField(formData, "behaviorNotes"),
      historyNotes: optionalStringField(formData, "historyNotes"),
      attentionNotes: optionalStringField(formData, "attentionNotes"),
      vetName: optionalStringField(formData, "vetName"),
      vetPhone: optionalStringField(formData, "vetPhone"),
      deliveredItems: optionalStringField(formData, "deliveredItems"),
    },
  });

  revalidatePath("/pets");
  revalidatePath(`/tutores/${tutorId}`);
  revalidatePath(`/tutores/${tutorId}/ficha`);
  redirect(`/pets/${pet.id}/ficha`);
}

export async function deletePetAction(id: string) {
  await requireUser();
  const reservationLinks = await getPrisma().reservationPet.count({ where: { petId: id } });
  if (reservationLinks > 0) {
    redirect(`/pets/${id}/ficha?error=pet-em-reservas`);
  }

  const pet = await getPrisma().pet.findUnique({ where: { id }, select: { tutorId: true } });
  await getPrisma().pet.delete({ where: { id } });

  revalidatePath("/pets");
  if (pet?.tutorId) {
    revalidatePath(`/tutores/${pet.tutorId}`);
    revalidatePath(`/tutores/${pet.tutorId}/ficha`);
  }
  redirect("/pets?deleted=1");
}

export async function updatePetAction(id: string, formData: FormData) {
  await requireUser();
  const name = stringField(formData, "name");
  if (!name) redirect(`/pets/${id}/ficha?error=nome-obrigatorio`);

  const current = await getPrisma().pet.findUnique({
    where: { id },
    select: { ageLabel: true, ageReferenceYear: true },
  });
  const { birthDate, ageLabel, ageYears } = resolveAgeFields(formData);
  const previousYears = parseAgeFromLabel(current?.ageLabel ?? null);
  const ageChanged = ageYears != null && ageYears !== previousYears;
  const ageReferenceYear = birthDate
    ? new Date().getFullYear()
    : ageYears == null
      ? null
      : ageChanged || current?.ageReferenceYear == null
        ? new Date().getFullYear()
        : current.ageReferenceYear;

  await getPrisma().pet.update({
    where: { id },
    data: {
      name,
      species: optionalStringField(formData, "species") ?? "dog",
      breed: optionalStringField(formData, "breed"),
      birthDate,
      ageLabel,
      ageReferenceYear,
      isNeutered: boolField(formData, "isNeutered"),
      isSociable: boolField(formData, "isSociable"),
      foodNotes: optionalStringField(formData, "foodNotes"),
      foodRestrictions: optionalStringField(formData, "foodRestrictions"),
      foodTreats: optionalStringField(formData, "foodTreats"),
      healthNotes: optionalStringField(formData, "healthNotes"),
      behaviorNotes: optionalStringField(formData, "behaviorNotes"),
      historyNotes: optionalStringField(formData, "historyNotes"),
      attentionNotes: optionalStringField(formData, "attentionNotes"),
      vetName: optionalStringField(formData, "vetName"),
      vetPhone: optionalStringField(formData, "vetPhone"),
      deliveredItems: optionalStringField(formData, "deliveredItems"),
    },
  });

  revalidatePath("/pets");
  revalidatePath(`/pets/${id}`);
  revalidatePath(`/pets/${id}/ficha`);
  redirect(`/pets/${id}/ficha?saved=1`);
}
