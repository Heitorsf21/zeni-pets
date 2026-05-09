"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import {
  centsField,
  centsFieldStrict,
  optionalStringField,
  stringField,
} from "@/lib/forms";
import type { ServiceKind, PaymentMethod } from "@/generated/prisma/client";

const SERVICE_KINDS: ServiceKind[] = [
  "BOARDING",
  "DAYCARE",
  "PET_SITTING",
  "DOG_WALKER",
  "TAXI_PET",
  "ADAPTATION",
  "OTHER",
];

const PAYMENT_METHODS: PaymentMethod[] = ["PIX", "CASH", "CARD", "TRANSFER", "OTHER"];

function asKind(value: string): ServiceKind {
  return (SERVICE_KINDS as readonly string[]).includes(value)
    ? (value as ServiceKind)
    : "OTHER";
}
function asMethod(value: string): PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value)
    ? (value as PaymentMethod)
    : "PIX";
}

export async function createServiceTypeAction(formData: FormData) {
  const name = stringField(formData, "name");
  if (!name) redirect("/configuracoes/servicos?error=nome-obrigatorio");

  await getPrisma().serviceType.create({
    data: {
      name,
      kind: asKind(stringField(formData, "kind")),
      description: optionalStringField(formData, "description"),
      isActive: formData.get("isActive") !== "off",
    },
  });

  revalidatePath("/configuracoes/servicos");
  redirect("/configuracoes/servicos?saved=1");
}

export async function updateServiceTypeAction(id: string, formData: FormData) {
  const name = stringField(formData, "name");
  if (!name) redirect("/configuracoes/servicos?error=nome-obrigatorio");

  await getPrisma().serviceType.update({
    where: { id },
    data: {
      name,
      kind: asKind(stringField(formData, "kind")),
      description: optionalStringField(formData, "description"),
      isActive: formData.get("isActive") !== "off",
    },
  });

  revalidatePath("/configuracoes/servicos");
  redirect("/configuracoes/servicos?saved=1");
}

export async function deleteServiceTypeAction(id: string) {
  const usage = await getPrisma().reservation.count({ where: { serviceTypeId: id } });
  if (usage > 0) redirect("/configuracoes/servicos?error=servico-em-uso");

  await getPrisma().serviceType.delete({ where: { id } });
  revalidatePath("/configuracoes/servicos");
  redirect("/configuracoes/servicos?deleted=1");
}

export async function createPriceRuleAction(formData: FormData) {
  const serviceTypeId = stringField(formData, "serviceTypeId");
  const label = stringField(formData, "label");
  const firstPet = centsFieldStrict(formData, "firstPetCents");
  if (!serviceTypeId || !label || firstPet == null) {
    redirect("/configuracoes/servicos?error=dados-invalidos");
  }

  await getPrisma().servicePriceRule.create({
    data: {
      serviceTypeId,
      label,
      paymentMethod: asMethod(stringField(formData, "paymentMethod")),
      firstPetCents: firstPet,
      additionalPetCents: centsField(formData, "additionalPetCents", 0) || null,
      highSeasonFirstPetCents: centsField(formData, "highSeasonFirstPetCents", 0) || null,
      highSeasonAdditionalCents: centsField(formData, "highSeasonAdditionalCents", 0) || null,
      fixedFeeCents: centsField(formData, "fixedFeeCents", 0) || null,
      perKmCents: centsField(formData, "perKmCents", 0) || null,
      hygieneFeeCents: centsField(formData, "hygieneFeeCents", 0) || null,
      isActive: formData.get("isActive") !== "off",
    },
  });

  revalidatePath("/configuracoes/servicos");
  redirect("/configuracoes/servicos?saved=1");
}

export async function updatePriceRuleAction(id: string, formData: FormData) {
  const label = stringField(formData, "label");
  const firstPet = centsFieldStrict(formData, "firstPetCents");
  if (!label || firstPet == null) {
    redirect("/configuracoes/servicos?error=dados-invalidos");
  }

  await getPrisma().servicePriceRule.update({
    where: { id },
    data: {
      label,
      paymentMethod: asMethod(stringField(formData, "paymentMethod")),
      firstPetCents: firstPet,
      additionalPetCents: centsField(formData, "additionalPetCents", 0) || null,
      highSeasonFirstPetCents: centsField(formData, "highSeasonFirstPetCents", 0) || null,
      highSeasonAdditionalCents: centsField(formData, "highSeasonAdditionalCents", 0) || null,
      fixedFeeCents: centsField(formData, "fixedFeeCents", 0) || null,
      perKmCents: centsField(formData, "perKmCents", 0) || null,
      hygieneFeeCents: centsField(formData, "hygieneFeeCents", 0) || null,
      isActive: formData.get("isActive") !== "off",
    },
  });

  revalidatePath("/configuracoes/servicos");
  redirect("/configuracoes/servicos?saved=1");
}

export async function deletePriceRuleAction(id: string) {
  await getPrisma().servicePriceRule.delete({ where: { id } });
  revalidatePath("/configuracoes/servicos");
  redirect("/configuracoes/servicos?deleted=1");
}
