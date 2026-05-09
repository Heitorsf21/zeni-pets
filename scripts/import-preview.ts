import { parseProjectDiagnostics } from "../src/lib/import/parsers";

async function main() {
  const batches = await parseProjectDiagnostics(process.cwd());

  for (const batch of batches) {
    const byType = batch.records.reduce<Record<string, number>>((acc, record) => {
      acc[record.detectedType] = (acc[record.detectedType] ?? 0) + 1;
      return acc;
    }, {});

    console.log(
      `${batch.fileName} (${batch.sourceKind}) - ${batch.records.length} registros`,
      byType,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
