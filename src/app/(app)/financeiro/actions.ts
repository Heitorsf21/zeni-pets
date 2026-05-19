"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentMethod, Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { centsFieldStrict, optionalStringField, stringField } from "@/lib/forms";
import { parseDateOnly } from "@/lib/date";
import { derivePaymentStatus, sumPaidCents } from "@/lib/reservation-status";

const VALID_KINDS = ["INCOME", "EXPENSE"] as const;
const VALID_METHODS = ["PIX", "CASH", "CARD", "TRANSFER", "CREDIT", "OTHER"] as const;

type FinancialEntryForDeletion = {
  id: string;
  reservationId: string | null;
  kind: "INCOME" | "EXPENSE";
  amountCents: number;
  method: PaymentMethod | null;
  importRecordId: string | null;
  entryDate: Date;
  createdAt: Date;
};

function dayWindow(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function findPaymentForFinancialEntry(
  tx: Prisma.TransactionClient,
  entry: FinancialEntryForDeletion & { reservationId: string },
) {
  if (entry.kind !== "INCOME") return null;

  const baseWhere: Prisma.PaymentWhereInput = {
    reservationId: entry.reservationId,
    amountCents: entry.amountCents,
    status: "PAID",
    ...(entry.method ? { method: entry.method } : {}),
  };

  if (entry.importRecordId) {
    const importedPayment = await tx.payment.findFirst({
      where: { ...baseWhere, importRecordId: entry.importRecordId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (importedPayment) return importedPayment;
  }

  const { start, end } = dayWindow(entry.entryDate);
  const sameDayPayment = await tx.payment.findFirst({
    where: {
      ...baseWhere,
      OR: [
        { paidAt: { gte: start, lte: end } },
        { createdAt: { gte: start, lte: end } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (sameDayPayment) return sameDayPayment;

  return tx.payment.findFirst({
    where: baseWhere,
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
}

async function findAmountOnlyPaymentForFinancialEntry(
  tx: Prisma.TransactionClient,
  entry: FinancialEntryForDeletion & { reservationId: string },
) {
  if (entry.kind !== "INCOME") return null;

  const baseWhere: Prisma.PaymentWhereInput = {
    reservationId: entry.reservationId,
    amountCents: entry.amountCents,
    status: "PAID",
  };

  const { start, end } = dayWindow(entry.entryDate);
  const sameDayPayment = await tx.payment.findFirst({
    where: {
      ...baseWhere,
      OR: [
        { paidAt: { gte: start, lte: end } },
        { createdAt: { gte: start, lte: end } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (sameDayPayment) return sameDayPayment;

  return tx.payment.findFirst({
    where: baseWhere,
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
}

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
      entryDate: parseDateOnly(formData.get("entryDate")) ?? new Date(),
      amountCents,
      method,
      isManual: true,
    },
  });

  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  redirect("/financeiro?saved=1");
}

export async function updateFinancialEntryAction(id: string, formData: FormData) {
  await requireUser();
  const amountCents = centsFieldStrict(formData, "amountCents");
  const category = stringField(formData, "category");
  const entryDate = parseDateOnly(formData.get("entryDate"));
  const kindRaw = stringField(formData, "kind");
  const requestedKind = (VALID_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as (typeof VALID_KINDS)[number])
    : "EXPENSE";
  const methodRaw = stringField(formData, "method");
  const method = (VALID_METHODS as readonly string[]).includes(methodRaw)
    ? (methodRaw as PaymentMethod)
    : null;

  if (!category || amountCents == null || amountCents <= 0 || !entryDate) {
    redirect("/financeiro?error=dados-invalidos");
  }

  const result = await getPrisma().$transaction(async (tx) => {
    const entry = await tx.financialEntry.findUnique({
      where: { id },
      select: {
        id: true,
        reservationId: true,
        kind: true,
        amountCents: true,
        method: true,
        importRecordId: true,
        entryDate: true,
        createdAt: true,
      },
    });
    if (!entry) return { ok: false as const, reason: "lancamento-nao-encontrado" };

    const nextKind = entry.reservationId ? "INCOME" : requestedKind;
    let tutorId: string | null = null;
    let payment = null as { id: string } | null;

    if (entry.reservationId && entry.kind === "INCOME") {
      const entryWithReservationId = { ...entry, reservationId: entry.reservationId };
      payment =
        await findPaymentForFinancialEntry(tx, entryWithReservationId) ??
        await findAmountOnlyPaymentForFinancialEntry(tx, entryWithReservationId);
    }

    await tx.financialEntry.update({
      where: { id },
      data: {
        kind: nextKind,
        category,
        description: optionalStringField(formData, "description"),
        entryDate,
        amountCents,
        method,
        isManual: true,
      },
    });

    if (entry.reservationId) {
      const paymentData = {
        amountCents,
        method: method ?? "OTHER",
        paidAt: entryDate,
        notes: optionalStringField(formData, "description") ?? category,
      };

      if (payment) {
        await tx.payment.update({ where: { id: payment.id }, data: paymentData });
      } else {
        await tx.payment.create({
          data: {
            reservationId: entry.reservationId,
            status: "PAID",
            ...paymentData,
          },
        });
      }

      const reservation = await tx.reservation.findUnique({
        where: { id: entry.reservationId },
        select: {
          tutorId: true,
          totalCents: true,
          payments: { select: { status: true, amountCents: true } },
        },
      });
      if (reservation) {
        tutorId = reservation.tutorId;
        const paidCents = sumPaidCents(reservation.payments);
        await tx.reservation.update({
          where: { id: entry.reservationId },
          data: { paymentStatus: derivePaymentStatus(paidCents, reservation.totalCents) },
        });
      }
    }

    return { ok: true as const, reservationId: entry.reservationId, tutorId };
  });

  if (!result.ok) redirect(`/financeiro?error=${result.reason}`);

  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  if (result.reservationId) {
    revalidatePath("/reservas");
    revalidatePath(`/reservas/${result.reservationId}`);
  }
  if (result.tutorId) {
    revalidatePath(`/tutores/${result.tutorId}`);
    revalidatePath(`/tutores/${result.tutorId}/ficha`);
  }
  redirect("/financeiro?saved=1");
}

export async function deleteFinancialEntryAction(id: string) {
  await requireUser();
  const result = await getPrisma().$transaction(async (tx) => {
    const entry = await tx.financialEntry.findUnique({
      where: { id },
      select: {
        id: true,
        reservationId: true,
        kind: true,
        amountCents: true,
        method: true,
        importRecordId: true,
        entryDate: true,
        createdAt: true,
      },
    });
    if (!entry) return { ok: false as const, reason: "lancamento-nao-encontrado" };

    let reservationId: string | null = null;
    let tutorId: string | null = null;
    let removedPayment = false;

    if (entry.reservationId) {
      reservationId = entry.reservationId;
      const entryWithReservationId = { ...entry, reservationId: entry.reservationId };
      const payment =
        await findPaymentForFinancialEntry(tx, entryWithReservationId) ??
        await findAmountOnlyPaymentForFinancialEntry(tx, entryWithReservationId);
      if (payment) {
        await tx.payment.delete({ where: { id: payment.id } });
        removedPayment = true;
      }
    }

    await tx.financialEntry.delete({ where: { id } });

    if (reservationId) {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          tutorId: true,
          totalCents: true,
          payments: { select: { status: true, amountCents: true } },
        },
      });

      if (reservation) {
        tutorId = reservation.tutorId;
        if (removedPayment && entry.method === "CREDIT") {
          const creditUse = await tx.tutorCreditTransaction.findFirst({
            where: {
              reservationId,
              tutorId: reservation.tutorId,
              type: "CREDIT_USED",
              amountCents: -Math.abs(entry.amountCents),
            },
            orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
            select: { id: true },
          });
          if (creditUse) {
            await tx.tutorCreditTransaction.delete({ where: { id: creditUse.id } });
          }
        }

        const paidCents = sumPaidCents(reservation.payments);
        await tx.reservation.update({
          where: { id: reservationId },
          data: { paymentStatus: derivePaymentStatus(paidCents, reservation.totalCents) },
        });
      }
    }

    return { ok: true as const, reservationId, tutorId };
  });

  if (!result.ok) redirect(`/financeiro?error=${result.reason}`);

  revalidatePath("/financeiro");
  revalidatePath("/dashboard");
  revalidatePath("/reservas");
  if (result.reservationId) revalidatePath(`/reservas/${result.reservationId}`);
  if (result.tutorId) {
    revalidatePath(`/tutores/${result.tutorId}`);
    revalidatePath(`/tutores/${result.tutorId}/ficha`);
  }
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
