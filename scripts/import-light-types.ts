/* Approves and imports the "light" record types (SERVICE_PRICE, TAXI_RULE, FINANCIAL_SUMMARY)
 * directly via the applier library. Skips records that need fuzzy matching (HISTORICAL_RESERVATION,
 * DAYCARE_RESERVATION, CLIENT_FORM, FINANCIAL_ENTRY) — those are imported manually after etapa 3.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { APPLIERS } from "../src/lib/import/applier";

const LIGHT_TYPES = ["SERVICE_PRICE", "TAXI_RULE", "FINANCIAL_SUMMARY"] as const;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  for (const type of LIGHT_TYPES) {
    const records = await prisma.importRecord.findMany({
      where: { detectedType: type, status: { in: ["PENDING_REVIEW", "APPROVED"] } },
      select: { id: true, batchId: true, detectedType: true, normalizedPayload: true, status: true },
    });

    let imported = 0;
    let failed = 0;

    for (const record of records) {
      if (!record.normalizedPayload || typeof record.normalizedPayload !== "object" || Array.isArray(record.normalizedPayload)) {
        failed++;
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
            reviewNotes: `Falha ao importar via script: ${result.reason}`,
          },
        });
        failed++;
      }
    }

    console.log(`${type}: ${imported} importados, ${failed} com falha (de ${records.length} encontrados)`);
  }

  console.log("\nResumo final:");
  const tipos = await prisma.serviceType.count();
  const regras = await prisma.servicePriceRule.count();
  const summaries = await prisma.financialSummary.count();
  console.log(`  ServiceType: ${tipos}, ServicePriceRule: ${regras}, FinancialSummary: ${summaries}`);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
}).finally(() => prisma.$disconnect());
