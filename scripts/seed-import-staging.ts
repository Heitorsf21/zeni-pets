import "dotenv/config";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { parseProjectDiagnostics } from "../src/lib/import/parsers";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to load import staging records.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const batches = await parseProjectDiagnostics(process.cwd());

  for (const batch of batches) {
    const createdBatch = await prisma.importBatch.upsert({
      where: {
        fileName_sourceKind: {
          fileName: batch.fileName,
          sourceKind: batch.sourceKind,
        },
      },
      update: { status: "PENDING_REVIEW" },
      create: {
        fileName: batch.fileName,
        sourceKind: batch.sourceKind,
        status: "PENDING_REVIEW",
      },
    });

    await prisma.importRecord.deleteMany({ where: { batchId: createdBatch.id } });
    await prisma.importRecord.createMany({
      data: batch.records.map((record) => ({
        batchId: createdBatch.id,
        sourceSheet: record.sourceSheet,
        sourceRow: record.sourceRow,
        sourceBlock: record.sourceBlock,
        rawPayload: record.rawPayload as Prisma.InputJsonValue,
        normalizedPayload: record.normalizedPayload as Prisma.InputJsonValue,
        detectedType: record.detectedType,
        confidence: record.confidence,
        status: record.status,
      })),
    });
  }

  console.log(
    "Import staging loaded:",
    batches.reduce((sum, batch) => sum + batch.records.length, 0),
    "records",
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
