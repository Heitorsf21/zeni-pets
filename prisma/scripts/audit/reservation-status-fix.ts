import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../src/generated/prisma/client";
import { deriveReservationStatus, sumPaidCents } from "../../../src/lib/reservation-status";
import type { PaymentStatus, ReservationStatus } from "../../../src/lib/reservation-status";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to audit reservation statuses.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const apply = process.argv.includes("--apply");
const includeAll = process.argv.includes("--all");
const nowValue = process.argv.find((arg) => arg.startsWith("--now="))?.slice("--now=".length);
const now = nowValue ? new Date(nowValue) : new Date();

if (Number.isNaN(now.getTime())) {
  throw new Error(`Invalid --now value: ${nowValue}`);
}

type StatusChange = {
  id: string;
  tutor: string;
  pets: string[];
  startsAt: string;
  endsAt: string;
  imported: boolean;
  before: {
    status: ReservationStatus;
    paymentStatus: PaymentStatus;
    actualEndedAt: string | null;
  };
  after: {
    status: ReservationStatus;
    paymentStatus: PaymentStatus;
    actualEndedAt: string | null;
  };
  reason: string;
};

function describeReason(change: Omit<StatusChange, "reason">) {
  if (change.before.status === "COMPLETED" && change.after.status !== "COMPLETED") {
    return "Reserva ainda nao ocorreu; status concluido era inconsistente.";
  }
  if (change.before.status !== change.after.status) {
    return "Status operacional recalculado por data atual e encerramento real.";
  }
  if (change.before.paymentStatus !== change.after.paymentStatus) {
    return "Status financeiro recalculado pela soma de pagamentos PAID.";
  }
  if (change.before.actualEndedAt !== change.after.actualEndedAt) {
    return "Saida real removida de reserva futura.";
  }
  return "Sem alteracao.";
}

async function main() {
  const reservations = await prisma.reservation.findMany({
    where: includeAll ? {} : { importRecordId: { not: null } },
    include: {
      tutor: { select: { name: true } },
      payments: { select: { status: true, amountCents: true } },
      reservationPets: { include: { pet: { select: { name: true } } } },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
  });

  const changes: StatusChange[] = [];

  for (const reservation of reservations) {
    const isFuture = reservation.startsAt.getTime() > now.getTime();
    const nextActualEndedAt = isFuture ? null : reservation.actualEndedAt;
    const derived = deriveReservationStatus({
      now,
      startsAt: reservation.startsAt,
      endsAt: reservation.endsAt,
      currentStatus: reservation.status,
      paidCents: sumPaidCents(reservation.payments),
      totalCents: reservation.totalCents,
      hasActualEnd: Boolean(nextActualEndedAt),
      cancelled: reservation.status === "CANCELLED",
    });

    const before = {
      status: reservation.status,
      paymentStatus: reservation.paymentStatus,
      actualEndedAt: reservation.actualEndedAt?.toISOString() ?? null,
    };
    const after = {
      status: derived.status,
      paymentStatus: derived.paymentStatus,
      actualEndedAt: nextActualEndedAt?.toISOString() ?? null,
    };
    const changed =
      before.status !== after.status ||
      before.paymentStatus !== after.paymentStatus ||
      before.actualEndedAt !== after.actualEndedAt;

    if (!changed) continue;

    const baseChange = {
      id: reservation.id,
      tutor: reservation.tutor.name,
      pets: reservation.reservationPets.map((item) => item.pet.name),
      startsAt: reservation.startsAt.toISOString(),
      endsAt: reservation.endsAt.toISOString(),
      imported: Boolean(reservation.importRecordId),
      before,
      after,
    };

    changes.push({ ...baseChange, reason: describeReason(baseChange) });
  }

  if (apply && changes.length) {
    await prisma.$transaction(
      changes.map((change) =>
        prisma.reservation.update({
          where: { id: change.id },
          data: {
            status: change.after.status,
            paymentStatus: change.after.paymentStatus,
            actualEndedAt: change.after.actualEndedAt ? new Date(change.after.actualEndedAt) : null,
          },
        }),
      ),
    );
  }

  const report = {
    generatedAt: new Date().toISOString(),
    now: now.toISOString(),
    mode: apply ? "apply" : "dry-run",
    scope: includeAll ? "all-reservations" : "imported-reservations",
    scanned: reservations.length,
    changed: changes.length,
    changes,
  };

  const outputDir = path.join(process.cwd(), "prisma", "scripts", "audit");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "reservation-status-fix.report.json");
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`${apply ? "Applied" : "Dry-run"} reservation status fix: ${changes.length}/${reservations.length} changed.`);
  console.log(`Report written to ${outputPath}`);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
