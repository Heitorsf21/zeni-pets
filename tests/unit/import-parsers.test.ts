import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseFileForStaging } from "@/lib/import/parsers";

const root = process.cwd();

describe("diagnostic import staging parsers", () => {
  it("parses service prices and taxi rules from the 2026 price sheet", async () => {
    const batch = await parseFileForStaging(path.join(root, "Planilha Valores 2026.xlsx"));
    expect(batch.sourceKind).toBe("PRICE_SHEET");
    expect(batch.records.filter((record) => record.detectedType === "SERVICE_PRICE").length).toBeGreaterThan(8);
    expect(batch.records.filter((record) => record.detectedType === "TAXI_RULE").length).toBe(2);
  });

  it("stages historical reservations, daycare, monthly finance, and total rows as summaries", async () => {
    const batch = await parseFileForStaging(path.join(root, "Zeni Pets 2025.xlsx"));
    expect(batch.records.some((record) => record.detectedType === "HISTORICAL_RESERVATION")).toBe(true);
    expect(batch.records.some((record) => record.detectedType === "DAYCARE_RESERVATION")).toBe(true);
    expect(batch.records.some((record) => record.detectedType === "FINANCIAL_ENTRY")).toBe(true);
    expect(batch.records.some((record) => record.detectedType === "FINANCIAL_SUMMARY")).toBe(true);
    expect(
      batch.records.some(
        (record) =>
          record.detectedType === "FINANCIAL_ENTRY" &&
          record.normalizedPayload?.category === "Hospedagem Thor" &&
          record.normalizedPayload?.kind === "INCOME",
      ),
    ).toBe(true);
    expect(
      batch.records.some(
        (record) =>
          record.detectedType === "FINANCIAL_ENTRY" &&
          record.normalizedPayload?.category === "Instagram" &&
          record.normalizedPayload?.kind === "EXPENSE",
      ),
    ).toBe(true);
    expect(
      batch.records.some(
        (record) =>
          record.detectedType === "FINANCIAL_ENTRY" &&
          String(record.rawPayload.Categoria ?? "").startsWith("Total"),
      ),
    ).toBe(false);
  });

  it("marks incomplete daycare schedules for review", async () => {
    const batch = await parseFileForStaging(path.join(root, "Zeni Pets 2025.xlsx"));
    expect(
      batch.records.some(
        (record) => record.detectedType === "DAYCARE_RESERVATION" && record.status === "NEEDS_REVIEW",
      ),
    ).toBe(true);
  });

  it("parses the DOCX client form into 56 staging blocks and 76 pet lines", async () => {
    const batch = await parseFileForStaging(path.join(root, "Zeni Pets (Dados dos Clientes).docx"));
    const petLines = batch.records.reduce((sum, record) => {
      const pets = record.normalizedPayload?.pets;
      return sum + (Array.isArray(pets) ? pets.length : 0);
    }, 0);

    expect(batch.records).toHaveLength(56);
    expect(petLines).toBe(76);
  });
});
