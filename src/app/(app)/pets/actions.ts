"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { boolField, optionalStringField, stringField } from "@/lib/forms";
import { getPrisma } from "@/lib/db";

export async function createPetAction(formData: FormData) {
  await requireUser();
  const tutorId = stringField(formData, "tutorId");
  const name = stringField(formData, "name");
  if (!tutorId || !name) redirect("/pets?error=dados-obrigatorios");

  const pet = await getPrisma().pet.create({
    data: {
      tutorId,
      name,
      species: optionalStringField(formData, "species") ?? "dog",
      breed: optionalStringField(formData, "breed"),
      ageLabel: optionalStringField(formData, "ageLabel"),
      isNeutered: boolField(formData, "isNeutered"),
      isSociable: boolField(formData, "isSociable"),
      foodNotes: optionalStringField(formData, "foodNotes"),
      healthNotes: optionalStringField(formData, "healthNotes"),
      behaviorNotes: optionalStringField(formData, "behaviorNotes"),
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

  await getPrisma().pet.update({
    where: { id },
    data: {
      name,
      species: optionalStringField(formData, "species") ?? "dog",
      breed: optionalStringField(formData, "breed"),
      ageLabel: optionalStringField(formData, "ageLabel"),
      isNeutered: boolField(formData, "isNeutered"),
      isSociable: boolField(formData, "isSociable"),
      foodNotes: optionalStringField(formData, "foodNotes"),
      healthNotes: optionalStringField(formData, "healthNotes"),
      behaviorNotes: optionalStringField(formData, "behaviorNotes"),
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
