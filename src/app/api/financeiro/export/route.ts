import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  const entries = await getPrisma().financialEntry.findMany({
    orderBy: { entryDate: "desc" },
    include: { reservation: { include: { tutor: true, serviceType: true } } },
  });

  const rows = [
    ["data", "tipo", "categoria", "descricao", "tutor", "servico", "metodo", "valor_centavos"],
    ...entries.map((entry) => [
      entry.entryDate.toISOString().slice(0, 10),
      entry.kind,
      entry.category,
      entry.description ?? "",
      entry.reservation?.tutor.name ?? "",
      entry.reservation?.serviceType.name ?? "",
      entry.method ?? "",
      entry.amountCents,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="zeni-pets-financeiro.csv"',
    },
  });
}
