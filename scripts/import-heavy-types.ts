/* Approves and imports the "heavy" record types (HISTORICAL_RESERVATION, DAYCARE_RESERVATION,
 * FINANCIAL_ENTRY, CLIENT_FORM) directly via the applier library. Records that fail fuzzy
 * matching (ambiguous tutor/pet/service) are marked NEEDS_REVIEW with a reason for manual fixup.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { APPLIERS } from "../src/lib/import/applier";

const HEAVY_TYPES = [
  "CLIENT_FORM",
  "HISTORICAL_RESERVATION",
  "DAYCARE_RESERVATION",
  "FINANCIAL_ENTRY",
] as const;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  for (const type of HEAVY_TYPES) {
    const records = await prisma.importRecord.findMany({
      where: { detectedType: type, status: { in: ["PENDING_REVIEW", "APPROVED"] } },
      select: { id: true, batchId: true, detectedType: true, normalizedPayload: true },
    });

    let imported = 0;
    let failed = 0;

    for (const record of records) {
      if (!record.normalizedPayload || typeof record.normalizedPayload !== "object" || Array.isArray(record.normalizedPayload)) {
        failed++;
        await prisma.importRecord.update({
          where: { id: record.id },
          data: { status: "NEEDS_REVIEW", reviewNotes: "Payload invalido ou ausente" },
        });
        continue;
      }
      const applier = APPLIERS[type as keyof typeof APPLIERS];
      const result = await applier(prisma, record.id, record.normalizedPayload as Record<string, unknown>);
      if (result.ok) {
        await prisma.importRecord.update({
          where: { id: record.id },
          data: {
            status: "IMPORTED",
            reviewNotes: `Importado via script: ${result.targetModel} ${result.targetId}`,
          },
        });
        await prisma.importResolution.create({
          data: {
            batchId: record.batchId,
            sourceRecordId: record.id,
            action: "IMPORT_RECORD",
            targetModel: result.targetModel,
            targetId: result.targetId,
          },
        });
        imported++;
      } else {
        await prisma.importRecord.update({
          where: { id: record.id },
          data: {
            status: "NEEDS_REVIEW",
            reviewNotes: `Falha: ${result.reason}`,
          },
        });
        failed++;
      }
    }

    console.log(`${type}: ${imported} importados, ${failed} marcados para revisao (de ${records.length})`);
  }

  console.log("\nResumo final:");
  const counts = {
    tutores: await prisma.tutor.count(),
    pets: await prisma.pet.count(),
    reservas: await prisma.reservation.count(),
    pagamentos: await prisma.payment.count(),
    lancamentos: await prisma.financialEntry.count(),
    fechamentos: await prisma.financialSummary.count(),
  };
  console.log(`  Tutores: ${counts.tutores}, Pets: ${counts.pets}, Reservas: ${counts.reservas}, Pagamentos: ${counts.pagamentos}, Lancamentos: ${counts.lancamentos}, Fechamentos: ${counts.fechamentos}`);

  console.log("\nFalhas detalhadas (top 20):");
  const failures = await prisma.importRecord.findMany({
    where: { status: "NEEDS_REVIEW" },
    select: { detectedType: true, reviewNotes: true },
    take: 20,
  });
  const byReason: Record<string, number> = {};
  for (const f of failures) {
    const reason = f.reviewNotes ?? "sem nota";
    byReason[reason] = (byReason[reason] ?? 0) + 1;
  }
  for (const [reason, count] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
    console.log(`  [${count}] ${reason}`);
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
}).finally(() => prisma.$disconnect());
