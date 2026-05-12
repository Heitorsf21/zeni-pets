import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { parseProjectDiagnostics } from "@/lib/import/parsers";

export async function GET() {
  if (!(await getSessionUserId())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const batches = await parseProjectDiagnostics(process.cwd());
  return NextResponse.json({
    batches: batches.map((batch) => ({
      fileName: batch.fileName,
      sourceKind: batch.sourceKind,
      records: batch.records.length,
      byType: batch.records.reduce<Record<string, number>>((acc, record) => {
        acc[record.detectedType] = (acc[record.detectedType] ?? 0) + 1;
        return acc;
      }, {}),
    })),
  });
}
