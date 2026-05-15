import { describe, expect, it, vi } from "vitest";
import {
  applyHistoricalReservation,
  isClientCreditPeriod,
  parseDaycareSchedule,
  parseFinancialSummarySheet,
  parseHistoricalPeriod,
} from "@/lib/import/applier";

describe("parseHistoricalPeriod", () => {
  it("parses single date DD/MM/YYYY", () => {
    const result = parseHistoricalPeriod("15/05/2025");
    expect(result).not.toBeNull();
    expect(result![0].getDate()).toBe(15);
    expect(result![0].getMonth()).toBe(4);
    expect(result![0].getFullYear()).toBe(2025);
  });

  it("parses 'DD a DD/MM/YYYY' (with à or a)", () => {
    const a = parseHistoricalPeriod("12 à 16/06/2025");
    const b = parseHistoricalPeriod("12 a 16/06/2025");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a![0].getDate()).toBe(12);
    expect(a![1].getDate()).toBe(16);
  });

  it("parses 'DD e DD/MM/YYYY'", () => {
    const result = parseHistoricalPeriod("02 e 03/05/2025");
    expect(result).not.toBeNull();
    expect(result![0].getDate()).toBe(2);
    expect(result![1].getDate()).toBe(3);
  });

  it("parses full range with two dates", () => {
    const result = parseHistoricalPeriod("29/12/2025 a 06/01/2026");
    expect(result).not.toBeNull();
    expect(result![0].getMonth()).toBe(11);
    expect(result![1].getMonth()).toBe(0);
    expect(result![1].getFullYear()).toBe(2026);
  });

  it("parses ISO dates generated from Excel serial cells", () => {
    const result = parseHistoricalPeriod("2025-08-17T00:00:00.000Z");
    expect(result).not.toBeNull();
    expect(result![0].getDate()).toBe(17);
    expect(result![0].getMonth()).toBe(7);
    expect(result![0].getHours()).toBe(10);
    expect(result![1].getHours()).toBe(18);
  });

  it("parses ranges where the first year is implied", () => {
    const sameYear = parseHistoricalPeriod("25/06 a 01/07/2026");
    const previousYear = parseHistoricalPeriod("31/12 a 01/01/2026");
    expect(sameYear).not.toBeNull();
    expect(previousYear).not.toBeNull();
    expect(sameYear![0].getFullYear()).toBe(2026);
    expect(sameYear![1].getMonth()).toBe(6);
    expect(previousYear![0].getFullYear()).toBe(2025);
    expect(previousYear![1].getFullYear()).toBe(2026);
  });

  it("parses comma-separated visit dates as the first-to-last range", () => {
    const result = parseHistoricalPeriod("31/12, 02/01, 04 e 06/01/2026");
    expect(result).not.toBeNull();
    expect(result![0].getDate()).toBe(31);
    expect(result![0].getMonth()).toBe(11);
    expect(result![0].getFullYear()).toBe(2025);
    expect(result![1].getDate()).toBe(6);
    expect(result![1].getMonth()).toBe(0);
    expect(result![1].getFullYear()).toBe(2026);
  });

  it("returns null for unparseable strings", () => {
    expect(parseHistoricalPeriod("")).toBeNull();
    expect(parseHistoricalPeriod("amanha")).toBeNull();
    expect(parseHistoricalPeriod("32/01/2026")).toBeNull();
  });
});

describe("historical reservation import edge cases", () => {
  it("detects client credit notes", () => {
    expect(isClientCreditPeriod("FICOU DE CRÉDITO")).toBe(true);
    expect(isClientCreditPeriod("ficou de credito")).toBe(true);
    expect(isClientCreditPeriod("15/05/2025")).toBe(false);
  });

  it("imports 'ficou de credito' as tutor credit without creating a reservation", async () => {
    const db = {
      tutorCreditTransaction: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "credit-1" }),
      },
      importRecord: {
        findUnique: vi.fn().mockResolvedValue({ createdAt: new Date(2026, 0, 5, 9, 0) }),
      },
      tutor: {
        findMany: vi.fn().mockResolvedValue([{ id: "tutor-1", name: "Fabiana Gomes" }]),
      },
    };

    const result = await applyHistoricalReservation(db as never, "record-1", {
      period: "FICOU DE CRÉDITO",
      tutorName: "Fabiana Gomes",
      pets: "Kiara",
      amountCents: 10000,
      payment: "PIX",
    });

    expect(result).toEqual({ ok: true, targetModel: "TutorCreditTransaction", targetId: "credit-1" });
    expect(db.tutorCreditTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tutorId: "tutor-1",
        type: "CREDIT_ADDED",
        description: "Sinal em crédito - Fabiana Gomes / Kiara",
        amountCents: 10000,
        importRecordId: "record-1",
      }),
      select: { id: true },
    });
  });
});

describe("parseDaycareSchedule", () => {
  const date = new Date(2025, 4, 4);

  it("parses '11:30 as 18h'", () => {
    const range = parseDaycareSchedule(date, "11:30 as 18h");
    expect(range).not.toBeNull();
    expect(range![0].getHours()).toBe(11);
    expect(range![0].getMinutes()).toBe(30);
    expect(range![1].getHours()).toBe(18);
  });

  it("parses '09:00 às 18:00'", () => {
    const range = parseDaycareSchedule(date, "09:00 às 18:00");
    expect(range).not.toBeNull();
    expect(range![0].getHours()).toBe(9);
    expect(range![1].getHours()).toBe(18);
  });

  it("returns null when end is before start", () => {
    expect(parseDaycareSchedule(date, "18h as 09h")).toBeNull();
  });
});

describe("parseFinancialSummarySheet", () => {
  it("parses 'Junho 2025'", () => {
    expect(parseFinancialSummarySheet("Junho 2025")).toEqual({ year: 2025, month: 6 });
  });

  it("handles accented months", () => {
    expect(parseFinancialSummarySheet("Março 2025")).toEqual({ year: 2025, month: 3 });
  });

  it("returns null for unknown month names", () => {
    expect(parseFinancialSummarySheet("XPTO 2025")).toBeNull();
    expect(parseFinancialSummarySheet("")).toBeNull();
  });
});
