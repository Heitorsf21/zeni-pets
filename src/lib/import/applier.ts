import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { deriveReservationStatus } from "@/lib/reservation-status";

type Db = PrismaClient | Prisma.TransactionClient;

const MONTHS_PT_BR: Record<string, number> = {
  janeiro: 0, fevereiro: 1, março: 2, marco: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

function paymentMethodFromText(value: unknown) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("pix")) return "PIX" as const;
  if (text.includes("dinheiro") || text.includes("cash")) return "CASH" as const;
  if (text.includes("cart")) return "CARD" as const;
  if (text.includes("transfer") || text.includes("ted") || text.includes("doc")) return "TRANSFER" as const;
  return "OTHER" as const;
}

/** Parse strings like "12 a 16/06/2025", "12 e 13/05/2025", "DD/MM/YYYY". Returns [start, end] or null. */
export function parseHistoricalPeriod(period: string): [Date, Date] | null {
  if (!period) return null;
  const trimmed = period.replace(/à/g, "a").replace(/\s+/g, " ").trim();

  // Single date "DD/MM/YYYY"
  const single = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (single) {
    const date = new Date(Number(single[3]), Number(single[2]) - 1, Number(single[1]), 10, 0, 0);
    if (Number.isNaN(date.getTime())) return null;
    return [date, new Date(date.getTime() + 8 * 60 * 60 * 1000)];
  }

  // Range with 2 days "DD a DD/MM/YYYY" or "DD e DD/MM/YYYY"
  const range = trimmed.match(/^(\d{1,2})\s*(?:a|e|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/i);
  if (range) {
    const startDay = Number(range[1]);
    const endDay = Number(range[2]);
    const month = Number(range[3]) - 1;
    const year = Number(range[4]);
    const start = new Date(year, month, startDay, 10, 0, 0);
    const end = new Date(year, month, endDay, 18, 0, 0);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return [start, end];
  }

  // Full range "DD/MM/YYYY a DD/MM/YYYY"
  const fullRange = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(?:a|e|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})$/i);
  if (fullRange) {
    const start = new Date(Number(fullRange[3]), Number(fullRange[2]) - 1, Number(fullRange[1]), 10, 0, 0);
    const end = new Date(Number(fullRange[6]), Number(fullRange[5]) - 1, Number(fullRange[4]), 18, 0, 0);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return [start, end];
  }

  return null;
}

/** Parse strings like "11:30 as 18h", "9h às 18h", "10:00 - 18:00". */
export function parseDaycareSchedule(date: Date, schedule: string): [Date, Date] | null {
  const trimmed = (schedule ?? "").replace(/à/g, "a").toLowerCase().trim();
  const match = trimmed.match(/(\d{1,2})(?::?(\d{2}))?\s*h?\s*(?:as|a|-)\s*(\d{1,2})(?::?(\d{2}))?\s*h?/i);
  if (!match) return null;
  const startH = Number(match[1]);
  const startM = match[2] ? Number(match[2]) : 0;
  const endH = Number(match[3]);
  const endM = match[4] ? Number(match[4]) : 0;
  if ([startH, startM, endH, endM].some((v) => Number.isNaN(v))) return null;
  const start = new Date(date);
  start.setHours(startH, startM, 0, 0);
  const end = new Date(date);
  end.setHours(endH, endM, 0, 0);
  if (end.getTime() <= start.getTime()) return null;
  return [start, end];
}

/** Parse "Junho 2025" -> { year: 2025, month: 5 (0-based) }. */
export function parseFinancialSummarySheet(sheetName: string): { year: number; month: number } | null {
  const trimmed = (sheetName ?? "").trim().toLowerCase();
  const match = trimmed.match(/^([a-zçãéíóú]+)\s+(\d{4})$/i);
  if (!match) return null;
  const month = MONTHS_PT_BR[match[1].toLowerCase()];
  const year = Number(match[2]);
  if (month == null || Number.isNaN(year)) return null;
  return { year, month: month + 1 };
}

/** Find a tutor by exact case-insensitive name. Returns array (caller decides on ambiguity). */
export async function findTutorsByName(db: Db, name: string) {
  return db.tutor.findMany({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
}

export async function findServiceTypeByName(db: Db, name: string) {
  return db.serviceType.findFirst({
    where: { name: { contains: name, mode: "insensitive" } },
    select: { id: true, name: true, kind: true },
  });
}

export type ApplyResult =
  | { ok: true; targetModel: string; targetId: string }
  | { ok: false; reason: string };

/** Common helper: resolve tutor by name. Auto-creates if absent and there's no homonym.
 *  Refuses (reason="ambiguo") if 2+ tutors share the name. */
async function resolveTutor(db: Db, name: string): Promise<{ id: string } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "tutor-sem-nome" };
  const matches = await findTutorsByName(db, trimmed);
  if (matches.length === 1) return { id: matches[0].id };
  if (matches.length === 0) {
    const created = await db.tutor.create({ data: { name: trimmed } });
    return { id: created.id };
  }
  return { error: "tutor-ambiguo" };
}

async function resolvePet(db: Db, tutorId: string, name: string): Promise<{ id: string } | { error: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "pet-sem-nome" };
  const matches = await db.pet.findMany({
    where: { tutorId, name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (matches.length === 1) return { id: matches[0].id };
  if (matches.length === 0) {
    const created = await db.pet.create({ data: { tutorId, name: trimmed } });
    return { id: created.id };
  }
  return { error: "pet-ambiguo" };
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function asNumberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asDateOrNull(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function applyClientForm(db: Db, recordId: string, payload: Record<string, unknown>): Promise<ApplyResult> {
  const tutorName = asString(payload.tutorName);
  if (!tutorName) return { ok: false, reason: "tutor-sem-nome" };

  const petsLines = Array.isArray(payload.pets)
    ? payload.pets.map((p) => String(p)).filter(Boolean)
    : [];

  const tutor = await db.tutor.create({
    data: {
      name: tutorName,
      document: asString(payload.document),
      address: asString(payload.address),
      cep: asString(payload.cep),
      phone: asString(payload.phone),
      email: asString(payload.email),
      notes: asString(payload.notes),
      importRecordId: recordId,
      pets: {
        create: petsLines.map((line) => ({
          name: line.split(",")[0]?.trim() || "Pet sem nome",
          breed: line.split(",")[1]?.trim() || null,
          ageLabel: line.split(",")[2]?.trim() || null,
          importRecordId: recordId,
        })),
      },
    },
    select: { id: true },
  });
  return { ok: true, targetModel: "Tutor", targetId: tutor.id };
}

export async function applyServicePrice(db: Db, recordId: string, payload: Record<string, unknown>): Promise<ApplyResult> {
  const serviceName = asString(payload.service);
  if (!serviceName) return { ok: false, reason: "servico-sem-nome" };

  const slug = serviceName.toLowerCase().replace(/\s+/g, "-");
  const lower = serviceName.toLowerCase();
  const service = await db.serviceType.upsert({
    where: { id: `imported-${slug}` },
    create: {
      id: `imported-${slug}`,
      name: serviceName,
      kind: lower.includes("creche") ? "DAYCARE" :
            lower.includes("hosped") ? "BOARDING" :
            lower.includes("visit") ? "PET_SITTING" : "OTHER",
    },
    update: {},
  });

  const label = asString(payload.details) ?? "1° pet";
  for (const method of ["PIX", "CARD"] as const) {
    const cents = method === "PIX" ? asNumberOrNull(payload.pixCents) : asNumberOrNull(payload.cardCents);
    const highCents = method === "PIX" ? asNumberOrNull(payload.highSeasonPixCents) : asNumberOrNull(payload.highSeasonCardCents);
    if (cents == null) continue;
    await db.servicePriceRule.upsert({
      where: {
        serviceTypeId_label_paymentMethod: {
          serviceTypeId: service.id,
          label,
          paymentMethod: method,
        },
      },
      create: {
        serviceTypeId: service.id,
        label,
        paymentMethod: method,
        firstPetCents: cents,
        highSeasonFirstPetCents: highCents,
        importRecordId: recordId,
      },
      update: {
        firstPetCents: cents,
        highSeasonFirstPetCents: highCents,
      },
    });
  }
  return { ok: true, targetModel: "ServiceType", targetId: service.id };
}

export async function applyTaxiRule(db: Db, recordId: string, payload: Record<string, unknown>): Promise<ApplyResult> {
  const name = asString(payload.name) ?? "Taxi pet";
  const id = `imported-${name.toLowerCase().replace(/\s+/g, "-")}`;
  const fixedFeeCents = asNumberOrNull(payload.fixedFeeCents);
  const perKmCents = asNumberOrNull(payload.perKmCents);
  const hygieneFeeCents = asNumberOrNull(payload.hygieneFeeCents);

  const service = await db.serviceType.upsert({
    where: { id },
    create: { id, name, kind: "TAXI_PET" },
    update: { name },
  });
  await db.servicePriceRule.upsert({
    where: {
      serviceTypeId_label_paymentMethod: {
        serviceTypeId: service.id,
        label: "Taxi",
        paymentMethod: "PIX",
      },
    },
    create: {
      serviceTypeId: service.id,
      label: "Taxi",
      paymentMethod: "PIX",
      firstPetCents: 0,
      fixedFeeCents,
      perKmCents,
      hygieneFeeCents,
      importRecordId: recordId,
    },
    update: { fixedFeeCents, perKmCents, hygieneFeeCents },
  });
  return { ok: true, targetModel: "ServiceType", targetId: service.id };
}

export async function applyFinancialEntry(db: Db, recordId: string, payload: Record<string, unknown>): Promise<ApplyResult> {
  const amount = asNumberOrNull(payload.amountCents);
  if (amount == null || amount <= 0) return { ok: false, reason: "valor-invalido" };
  const entryDate = asDateOrNull(payload.date) ?? new Date();
  const category = asString(payload.category) ?? "Importado";
  const entry = await db.financialEntry.create({
    data: {
      kind: "INCOME",
      category,
      description: category,
      entryDate,
      amountCents: amount,
      isManual: false,
      importRecordId: recordId,
    },
  });
  return { ok: true, targetModel: "FinancialEntry", targetId: entry.id };
}

export async function applyFinancialSummary(db: Db, recordId: string, payload: Record<string, unknown>): Promise<ApplyResult> {
  const sheetName = asString(payload.sheetName) ?? "";
  const parsed = parseFinancialSummarySheet(sheetName);
  if (!parsed) return { ok: false, reason: "mes-invalido" };
  const amount = asNumberOrNull(payload.amountCents);
  if (amount == null) return { ok: false, reason: "valor-invalido" };
  const label = asString(payload.label) ?? "Total";
  const summary = await db.financialSummary.upsert({
    where: {
      kind_year_month_label: {
        kind: "MONTHLY_CLOSING",
        year: parsed.year,
        month: parsed.month,
        label,
      },
    },
    create: {
      kind: "MONTHLY_CLOSING",
      year: parsed.year,
      month: parsed.month,
      label,
      totalCents: amount,
      importRecordId: recordId,
    },
    update: { totalCents: amount },
  });
  return { ok: true, targetModel: "FinancialSummary", targetId: summary.id };
}

async function applyHistoricalReservationGeneric(
  db: Db,
  recordId: string,
  payload: Record<string, unknown>,
  range: [Date, Date],
  serviceFallbackName?: string,
): Promise<ApplyResult> {
  const tutorName = asString(payload.tutorName) ?? "";
  const tutorRes = await resolveTutor(db, tutorName);
  if ("error" in tutorRes) return { ok: false, reason: tutorRes.error };

  const petsRaw = asString(payload.pets) ?? asString(payload.petName) ?? "";
  const petNames = petsRaw.split(/\s*(?: e |,)\s*/).map((n) => n.trim()).filter(Boolean);
  if (!petNames.length) return { ok: false, reason: "sem-pets" };

  const petIds: string[] = [];
  for (const petName of petNames) {
    const petRes = await resolvePet(db, tutorRes.id, petName);
    if ("error" in petRes) return { ok: false, reason: petRes.error };
    petIds.push(petRes.id);
  }

  const serviceName = asString(payload.service) ?? serviceFallbackName ?? "";
  const service = await findServiceTypeByName(db, serviceName);
  if (!service) return { ok: false, reason: "servico-nao-encontrado" };

  const amountCents = asNumberOrNull(payload.amountCents);
  if (amountCents == null) return { ok: false, reason: "valor-invalido" };

  const method = paymentMethodFromText(payload.payment);

  const now = new Date();
  const isPast = range[1].getTime() <= now.getTime();
  const { status, paymentStatus } = deriveReservationStatus({
    now,
    startsAt: range[0],
    endsAt: range[1],
    currentStatus: "CONFIRMED",
    paidCents: amountCents,
    totalCents: amountCents,
    hasActualEnd: isPast,
  });

  const reservation = await db.reservation.create({
    data: {
      tutorId: tutorRes.id,
      serviceTypeId: service.id,
      status,
      paymentStatus,
      pickupMode: "TUTOR_DROPS_OFF",
      startsAt: range[0],
      endsAt: range[1],
      actualEndedAt: isPast ? range[1] : null,
      baseAmountCents: amountCents,
      totalCents: amountCents,
      depositSuggestedCents: amountCents,
      depositDueCents: 0,
      balanceDueCents: 0,
      importRecordId: recordId,
      reservationPets: {
        create: petIds.map((petId, idx) => ({
          petId,
          priceRole: idx === 0 ? "first_pet" : "additional_pet",
        })),
      },
      payments: {
        create: {
          amountCents,
          method,
          status: "PAID",
          paidAt: range[0],
          notes: "Importado",
          importRecordId: recordId,
        },
      },
      financialEntries: {
        create: {
          kind: "INCOME",
          category: service.name,
          description: `Importado - ${tutorName}`,
          entryDate: range[0],
          amountCents,
          method,
          importRecordId: recordId,
        },
      },
    },
    select: { id: true },
  });

  return { ok: true, targetModel: "Reservation", targetId: reservation.id };
}

export async function applyHistoricalReservation(db: Db, recordId: string, payload: Record<string, unknown>): Promise<ApplyResult> {
  const period = asString(payload.period) ?? "";
  const range = parseHistoricalPeriod(period);
  if (!range) return { ok: false, reason: "periodo-invalido" };
  return applyHistoricalReservationGeneric(db, recordId, payload, range);
}

export async function applyDaycareReservation(db: Db, recordId: string, payload: Record<string, unknown>): Promise<ApplyResult> {
  const date = asDateOrNull(payload.date);
  if (!date) return { ok: false, reason: "data-invalida" };
  const range = parseDaycareSchedule(date, asString(payload.schedule) ?? "") ?? [
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0),
    new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0),
  ];
  return applyHistoricalReservationGeneric(db, recordId, payload, range, "Creche");
}

export type ApplierMap = {
  [key in
    | "CLIENT_FORM"
    | "SERVICE_PRICE"
    | "TAXI_RULE"
    | "FINANCIAL_ENTRY"
    | "FINANCIAL_SUMMARY"
    | "HISTORICAL_RESERVATION"
    | "DAYCARE_RESERVATION"
  ]: (db: Db, recordId: string, payload: Record<string, unknown>) => Promise<ApplyResult>;
};

export const APPLIERS: ApplierMap = {
  CLIENT_FORM: applyClientForm,
  SERVICE_PRICE: applyServicePrice,
  TAXI_RULE: applyTaxiRule,
  FINANCIAL_ENTRY: applyFinancialEntry,
  FINANCIAL_SUMMARY: applyFinancialSummary,
  HISTORICAL_RESERVATION: applyHistoricalReservation,
  DAYCARE_RESERVATION: applyDaycareReservation,
};
