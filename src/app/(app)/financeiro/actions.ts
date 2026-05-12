"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { centsFieldStrict, optionalStringField, stringField } from "@/lib/forms";
import { derivePaymentStatus, sumPaidCents } from "@/lib/reservation-status";

const VALID_KINDS = ["INCOME", "EXPENSE"] as const;
const VALID_METHODS = ["PIX", "CASH", "CARD", "TRANSFER", "OTHER"] as const;

export async function createFinancialEntryAction(formData: FormData) {
  await requireUser();
  const amountCents = centsFieldStrict(formData, "amountCents");
  const category = stringField(formData, "category");
  const kindRaw = stringField(formData, "kind");
  const kind = (VALID_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as (typeof VALID_KINDS)[number])
    : "EXPENSE";
  const methodRaw = stringField(formData, "method");
  const method = (VALID_METHODS as readonly string[]).includes(methodRaw)
    ? (methodRaw as (typeof VALID_METHODS)[number])
    : null;

  if (!category || amountCents == null || amountCents <= 0) {
    redirect("/financeiro?error=dados-invalidos");
  }

  await getPrisma().financialEntry.create({
    data: {
      kind,
      category,
      description: optionalStringField(formData, "description"),
      entryDate: new Date(stringField(formData, "entryDate") || new Date()),
      amountCents,
      method,
      isManual: true,
    },
  });

  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  redirect("/financeiro?saved=1");
}

export async function deleteFinancialEntryAction(id: string) {
  await requireUser();
  const entry = await getPrisma().financialEntry.findUnique({
    where: { id },
    select: { isManual: true },
  });
  if (!entry) redirect("/financeiro?error=lancamento-nao-encontrado");
  if (!entry.isManual) {
    redirect("/financeiro?error=lancamento-automatico");
  }

  await getPrisma().financialEntry.delete({ where: { id } });

  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  redirect("/financeiro?deleted=1");
}

export async function markReservationPaidAction(id: string, formData?: FormData) {
  await requireUser();
  const methodRaw = formData ? stringField(formData, "method") : "PIX";
  const method = (VALID_METHODS as readonly string[]).includes(methodRaw)
    ? (methodRaw as (typeof VALID_METHODS)[number])
    : "PIX";
  const reservation = await getPrisma().reservation.findUnique({
    where: { id },
    include: {
      tutor: true,
      serviceType: true,
      payments: true,
    },
  });
  if (!reservation) redirect("/financeiro?error=reserva-nao-encontrada");

  const paidCents = sumPaidCents(reservation.payments);
  const remainingCents = Math.max(reservation.totalCents - paidCents, 0);

  if (remainingCents > 0) {
    await getPrisma().payment.create({
      data: {
        reservationId: id,
        amountCents: remainingCents,
        method,
        status: "PAID",
        paidAt: new Date(),
        notes: "Quitação pelo financeiro",
      },
    });

    await getPrisma().financialEntry.create({
      data: {
        reservationId: id,
        kind: "INCOME",
        category: reservation.serviceType.name,
        description: `Quitação - ${reservation.tutor.name}`,
        entryDate: new Date(),
        amountCents: remainingCents,
        method,
      },
    });
  }

  await getPrisma().reservation.update({
    where: { id },
    data: { paymentStatus: derivePaymentStatus(paidCents + remainingCents, reservation.totalCents) },
  });

  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
  revalidatePath(`/reservas/${id}`);
}
