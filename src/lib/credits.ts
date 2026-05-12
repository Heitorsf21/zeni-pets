import type { Prisma, PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export function signedCreditAmount(type: string, amountCents: number) {
  if (type === "CREDIT_USED" || type === "REFUND") return -Math.abs(amountCents);
  return amountCents;
}

export async function getTutorCreditBalance(db: Db, tutorId: string) {
  const aggregate = await db.tutorCreditTransaction.aggregate({
    where: { tutorId },
    _sum: { amountCents: true },
  });
  return aggregate._sum.amountCents ?? 0;
}

export function sumCreditBalance(
  transactions: ReadonlyArray<{ amountCents: number }>,
) {
  return transactions.reduce((sum, transaction) => sum + transaction.amountCents, 0);
}

export async function getOpenCreditBalance(db: Db) {
  const aggregate = await db.tutorCreditTransaction.aggregate({
    _sum: { amountCents: true },
  });
  return aggregate._sum.amountCents ?? 0;
}
