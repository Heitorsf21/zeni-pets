import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import {
  type ImportBatchDraft,
  type ImportDetectedType,
  parseProjectDiagnostics,
} from "../src/lib/import/parsers";
import { brl } from "../src/lib/money";

const REFERENCE_DATE = new Date("2026-04-29T00:00:00-03:00");
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "import-audit");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "zeni-pets-auditoria-importacao.xlsx");

type JsonRecord = Record<string, unknown>;

type TutorCandidate = {
  id: string;
  name: string;
  normalizedName: string;
  phone: string;
  phoneOriginal: string;
  document: string;
  email: string;
  address: string;
  cep: string;
  pets: string[];
  sourceFile: string;
  sourceKind: string;
  sourceSheet: string;
  sourceRow: string;
  sourceBlock: string;
  detectedType: ImportDetectedType;
  confidence: number;
};

type PetCandidate = {
  tutorKey: string;
  tutorName: string;
  petName: string;
  normalizedPetName: string;
  sourceFile: string;
  sourceSheet: string;
  sourceRow: string;
  sourceBlock: string;
  detectedType: ImportDetectedType;
};

type WorkbookSheet = {
  name: string;
  rows: (string | number | boolean | null)[][];
  widths?: number[];
  freezeHeader?: boolean;
  autofilter?: boolean;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function compact(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizeKey(value: unknown) {
  return stripDiacritics(compact(value))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAddress(value: unknown) {
  return compact(value)
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s+/g, " ")
    .replace(/,+$/g, "")
    .trim();
}

function digitsOnly(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function formatPhone(value: unknown) {
  let digits = digitsOnly(value);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length > 11) digits = digits.slice(-11);
  if (digits.length === 9 || digits.length === 8) digits = `31${digits}`;

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return compact(value);
}

function splitPetNames(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    const text = compact(item);
    if (!text) return [];
    const firstSegment = text.split(/[;,]/)[0] ?? text;
    return firstSegment
      .split(/\s+(?:e|&)\s+/i)
      .map((part) => compact(part))
      .filter(Boolean)
      .map((part) => part.replace(/^pet\s+/i, "").trim())
      .filter(Boolean);
  });
}

function unique(values: string[]) {
  return [...new Set(values.map(compact).filter(Boolean))];
}

function jsonPreview(value: unknown, maxLength = 1_000) {
  const text = JSON.stringify(value ?? {}, null, 2);
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function recordSource(record: ImportBatchDraft["records"][number]) {
  return {
    sourceSheet: record.sourceSheet ?? "",
    sourceRow: record.sourceRow ? String(record.sourceRow) : "",
    sourceBlock: record.sourceBlock ? String(record.sourceBlock) : "",
  };
}

function buildTutorCandidates(batches: ImportBatchDraft[]) {
  const candidates: TutorCandidate[] = [];

  for (const batch of batches) {
    for (const record of batch.records) {
      const normalized = asRecord(record.normalizedPayload);
      let name = "";
      let pets: string[] = [];

      if (record.detectedType === "CLIENT_FORM") {
        name = compact(normalized.tutorName);
        pets = splitPetNames(normalized.pets);
      } else if (record.detectedType === "HISTORICAL_RESERVATION") {
        name = compact(normalized.tutorName);
        pets = splitPetNames(normalized.pets);
      } else if (record.detectedType === "DAYCARE_RESERVATION") {
        name = compact(normalized.tutorName);
        pets = splitPetNames(normalized.petName);
      }

      if (!name) continue;

      const source = recordSource(record);
      candidates.push({
        id: `${batch.fileName}:${source.sourceSheet}:${source.sourceRow || source.sourceBlock}:${candidates.length + 1}`,
        name,
        normalizedName: normalizeKey(name),
        phone: formatPhone(normalized.phone),
        phoneOriginal: compact(normalized.phone),
        document: compact(normalized.document),
        email: compact(normalized.email).toLowerCase(),
        address: normalizeAddress(normalized.address),
        cep: compact(normalized.cep),
        pets,
        sourceFile: batch.fileName,
        sourceKind: batch.sourceKind,
        sourceSheet: source.sourceSheet,
        sourceRow: source.sourceRow,
        sourceBlock: source.sourceBlock,
        detectedType: record.detectedType,
        confidence: record.confidence,
      });
    }
  }

  return candidates;
}

function buildPetCandidates(tutors: TutorCandidate[]) {
  return tutors.flatMap<PetCandidate>((tutor) =>
    tutor.pets.map((petName) => ({
      tutorKey: tutor.normalizedName,
      tutorName: tutor.name,
      petName,
      normalizedPetName: normalizeKey(petName),
      sourceFile: tutor.sourceFile,
      sourceSheet: tutor.sourceSheet,
      sourceRow: tutor.sourceRow,
      sourceBlock: tutor.sourceBlock,
      detectedType: tutor.detectedType,
    })),
  );
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return groups;
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] =
        a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]) + 1;
    }
  }

  return matrix[a.length][b.length];
}

function similarity(a: string, b: string) {
  if (!a && !b) return 1;
  const longest = Math.max(a.length, b.length);
  if (!longest) return 0;
  return 1 - levenshtein(a, b) / longest;
}

function buildTutorConflictRows(tutors: TutorCandidate[]) {
  const rows: (string | number)[][] = [];
  const groups = groupBy(tutors, (tutor) => tutor.normalizedName);

  for (const [, group] of groups) {
    if (group.length < 2) continue;

    const names = unique(group.map((item) => item.name));
    const phones = unique(group.map((item) => item.phone));
    const documents = unique(group.map((item) => item.document));
    const addresses = unique(group.map((item) => item.address));
    const emails = unique(group.map((item) => item.email));
    const pets = unique(group.flatMap((item) => item.pets));
    const sources = unique(
      group.map((item) =>
        [item.sourceFile, item.sourceSheet, item.sourceRow || item.sourceBlock].filter(Boolean).join(" / "),
      ),
    );

    const hasConflict = phones.length > 1 || documents.length > 1 || addresses.length > 1;
    const decision = hasConflict
      ? "VALIDAR COM FERNANDA"
      : "MESCLAR TUTOR SUGERIDO";

    rows.push([
      decision,
      names.join(" | "),
      group.length,
      phones.join(" | "),
      documents.join(" | "),
      addresses.join(" | "),
      emails.join(" | "),
      pets.join(" | "),
      sources.join(" ; "),
    ]);
  }

  return rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1])));
}

function buildPetSuggestionRows(pets: PetCandidate[]) {
  const rows: (string | number)[][] = [];
  const byTutor = groupBy(pets, (pet) => pet.tutorKey);

  for (const [, tutorPets] of byTutor) {
    const byPet = groupBy(tutorPets, (pet) => pet.normalizedPetName);
    for (const [, group] of byPet) {
      if (group.length < 2) continue;
      rows.push([
        "MESCLAR PET SUGERIDO",
        group[0].tutorName,
        unique(group.map((item) => item.petName)).join(" | "),
        group.length,
        unique(group.map((item) => [item.sourceFile, item.sourceSheet, item.sourceRow || item.sourceBlock].filter(Boolean).join(" / "))).join(" ; "),
      ]);
    }

    const distinct = [...byPet.values()].map((group) => group[0]);
    for (let i = 0; i < distinct.length; i += 1) {
      for (let j = i + 1; j < distinct.length; j += 1) {
        const score = similarity(distinct[i].normalizedPetName, distinct[j].normalizedPetName);
        if (score >= 0.78 && distinct[i].normalizedPetName !== distinct[j].normalizedPetName) {
          rows.push([
            "VALIDAR PET PARECIDO",
            distinct[i].tutorName,
            `${distinct[i].petName} <> ${distinct[j].petName}`,
            Number(score.toFixed(2)),
            unique([distinct[i].sourceFile, distinct[j].sourceFile]).join(" ; "),
          ]);
        }
      }
    }
  }

  return rows.sort((a, b) => String(a[1]).localeCompare(String(b[1])) || String(a[0]).localeCompare(String(b[0])));
}

function parseMaybeDate(value: unknown) {
  const text = compact(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function suggestedReservationStatus(date: Date | null) {
  if (!date) return "NEEDS_REVIEW";
  if (date < REFERENCE_DATE) return "COMPLETED";
  if (date.toISOString().slice(0, 10) === REFERENCE_DATE.toISOString().slice(0, 10)) {
    return "IN_PROGRESS";
  }
  return "CONFIRMED";
}

function suggestedPaymentStatus(payment: unknown, amountCents: unknown) {
  const paymentText = compact(payment);
  const amount = typeof amountCents === "number" ? amountCents : Number(amountCents ?? 0);
  if (paymentText) return "PAID";
  if (amount > 0) return "NEEDS_REVIEW";
  return "";
}

function buildReservationRows(batches: ImportBatchDraft[]) {
  const rows: (string | number)[][] = [];

  for (const batch of batches) {
    for (const record of batch.records) {
      if (!["HISTORICAL_RESERVATION", "DAYCARE_RESERVATION"].includes(record.detectedType)) {
        continue;
      }
      const normalized = asRecord(record.normalizedPayload);
      const source = recordSource(record);
      const date = parseMaybeDate(normalized.period ?? normalized.date);
      const amountCents = Number(normalized.amountCents ?? 0);
      const payment = normalized.payment;

      rows.push([
        batch.fileName,
        source.sourceSheet,
        source.sourceRow,
        record.detectedType === "DAYCARE_RESERVATION" ? "Creche" : compact(normalized.service) || "Hospedagem",
        compact(normalized.tutorName),
        splitPetNames(normalized.pets ?? normalized.petName).join(" | "),
        date ? date.toISOString().slice(0, 10) : compact(normalized.period ?? normalized.date),
        compact(normalized.schedule),
        amountCents ? brl(amountCents) : "",
        compact(payment),
        suggestedReservationStatus(date),
        suggestedPaymentStatus(payment, amountCents),
        record.status,
        Number(record.confidence.toFixed(2)),
      ]);
    }
  }

  return rows;
}

function buildFinanceRows(batches: ImportBatchDraft[]) {
  const rows: (string | number)[][] = [];

  for (const batch of batches) {
    for (const record of batch.records) {
      if (record.detectedType !== "FINANCIAL_ENTRY") continue;
      const normalized = asRecord(record.normalizedPayload);
      const source = recordSource(record);
      const amountCents = Number(normalized.amountCents ?? 0);

      rows.push([
        batch.fileName,
        source.sourceSheet,
        source.sourceRow,
        compact(normalized.category),
        compact(normalized.date),
        amountCents ? brl(amountCents) : "",
        "RELATORIO OPERACIONAL NORMAL",
        record.status,
        Number(record.confidence.toFixed(2)),
        jsonPreview(record.rawPayload, 500),
      ]);
    }
  }

  return rows;
}

function buildPriceRows(batches: ImportBatchDraft[]) {
  const rows: (string | number)[][] = [];

  for (const batch of batches) {
    for (const record of batch.records) {
      if (!["SERVICE_PRICE", "TAXI_RULE"].includes(record.detectedType)) continue;
      const normalized = asRecord(record.normalizedPayload);
      const source = recordSource(record);

      rows.push([
        batch.fileName,
        source.sourceSheet,
        source.sourceRow,
        record.detectedType,
        compact(normalized.service ?? normalized.name),
        compact(normalized.details),
        moneyFromMaybeCents(normalized.pixCents ?? normalized.fixedFeeCents),
        moneyFromMaybeCents(normalized.cardCents),
        moneyFromMaybeCents(normalized.highSeasonPixCents),
        moneyFromMaybeCents(normalized.highSeasonCardCents),
        moneyFromMaybeCents(normalized.perKmCents),
        moneyFromMaybeCents(normalized.hygieneFeeCents),
        record.status,
        Number(record.confidence.toFixed(2)),
      ]);
    }
  }

  return rows;
}

function moneyFromMaybeCents(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? brl(value) : "";
}

function buildRawRows(batches: ImportBatchDraft[]) {
  const rows: (string | number)[][] = [];

  for (const batch of batches) {
    for (const record of batch.records) {
      const source = recordSource(record);
      rows.push([
        batch.fileName,
        batch.sourceKind,
        source.sourceSheet,
        source.sourceRow,
        source.sourceBlock,
        record.detectedType,
        record.status,
        Number(record.confidence.toFixed(2)),
        jsonPreview(record.normalizedPayload, 1_000),
        jsonPreview(record.rawPayload, 1_000),
      ]);
    }
  }

  return rows;
}

function buildSheets(batches: ImportBatchDraft[]): WorkbookSheet[] {
  const tutors = buildTutorCandidates(batches);
  const pets = buildPetCandidates(tutors);
  const tutorConflicts = buildTutorConflictRows(tutors);
  const petSuggestions = buildPetSuggestionRows(pets);
  const reservations = buildReservationRows(batches);
  const finance = buildFinanceRows(batches);
  const prices = buildPriceRows(batches);
  const raw = buildRawRows(batches);

  const summaryRows: (string | number)[][] = [
    ["Auditoria de importacao Zeni Pets", ""],
    ["Data de referencia operacional", "2026-04-29"],
    ["Arquivos oficiais analisados", batches.length],
    ["Registros de staging encontrados", batches.reduce((sum, batch) => sum + batch.records.length, 0)],
    ["Tutores candidatos", tutors.length],
    ["Grupos de tutor com repeticao/conflito", tutorConflicts.length],
    ["Pets candidatos", pets.length],
    ["Sugestoes de mesclagem/validacao de pets", petSuggestions.length],
    ["Reservas historicas e creche", reservations.length],
    ["Lancamentos financeiros", finance.length],
    ["Precos e regras de taxi", prices.length],
    ["Regra de reserva passada", "Check-out/data antes de 2026-04-29 -> COMPLETED"],
    ["Regra de reserva futura", "Data depois de 2026-04-29 -> CONFIRMED"],
    ["Regra de divergencia Google", "Marcar conflito no sistema, nao sobrescrever silenciosamente"],
    ["Regra de dados ambiguos", "Validar com Heitor/Fernanda antes de importar final"],
  ];

  const sourceRows = batches.map((batch) => [
    batch.fileName,
    batch.sourceKind,
    batch.records.length,
    countByType(batch, "SERVICE_PRICE"),
    countByType(batch, "TAXI_RULE"),
    countByType(batch, "CLIENT_FORM"),
    countByType(batch, "HISTORICAL_RESERVATION"),
    countByType(batch, "DAYCARE_RESERVATION"),
    countByType(batch, "FINANCIAL_ENTRY"),
  ]);

  return [
    {
      name: "Resumo",
      rows: summaryRows,
      widths: [34, 86],
    },
    {
      name: "Fontes",
      rows: [
        [
          "Arquivo",
          "Origem",
          "Total registros",
          "Precos",
          "Taxi",
          "Clientes DOCX",
          "Reservas historicas",
          "Creche",
          "Financeiro",
        ],
        ...sourceRows,
      ],
      widths: [34, 22, 16, 12, 12, 16, 20, 12, 14],
      freezeHeader: true,
      autofilter: true,
    },
    {
      name: "Conflitos Tutores",
      rows: [
        [
          "Decisao sugerida",
          "Tutor",
          "Ocorrencias",
          "Telefones",
          "Documentos",
          "Enderecos",
          "Emails",
          "Pets",
          "Origens",
        ],
        ...tutorConflicts,
      ],
      widths: [24, 30, 12, 32, 24, 58, 34, 42, 74],
      freezeHeader: true,
      autofilter: true,
    },
    {
      name: "Sugestoes Pets",
      rows: [
        ["Decisao sugerida", "Tutor", "Pet(s)", "Ocorrencias ou similaridade", "Origens"],
        ...petSuggestions,
      ],
      widths: [26, 30, 38, 24, 76],
      freezeHeader: true,
      autofilter: true,
    },
    {
      name: "Tutores Candidatos",
      rows: [
        [
          "Tutor",
          "Nome normalizado",
          "Telefone normalizado",
          "Telefone original",
          "Documento",
          "Email",
          "Endereco",
          "CEP",
          "Pets extraidos",
          "Arquivo",
          "Aba",
          "Linha",
          "Bloco",
          "Tipo",
          "Confianca",
        ],
        ...tutors.map((tutor) => [
          tutor.name,
          tutor.normalizedName,
          tutor.phone,
          tutor.phoneOriginal,
          tutor.document,
          tutor.email,
          tutor.address,
          tutor.cep,
          tutor.pets.join(" | "),
          tutor.sourceFile,
          tutor.sourceSheet,
          tutor.sourceRow,
          tutor.sourceBlock,
          tutor.detectedType,
          Number(tutor.confidence.toFixed(2)),
        ]),
      ],
      widths: [30, 30, 20, 20, 22, 32, 56, 14, 44, 34, 18, 10, 10, 24, 12],
      freezeHeader: true,
      autofilter: true,
    },
    {
      name: "Pets Candidatos",
      rows: [
        ["Tutor", "Pet", "Pet normalizado", "Arquivo", "Aba", "Linha", "Bloco", "Tipo"],
        ...pets.map((pet) => [
          pet.tutorName,
          pet.petName,
          pet.normalizedPetName,
          pet.sourceFile,
          pet.sourceSheet,
          pet.sourceRow,
          pet.sourceBlock,
          pet.detectedType,
        ]),
      ],
      widths: [30, 24, 24, 34, 18, 10, 10, 24],
      freezeHeader: true,
      autofilter: true,
    },
    {
      name: "Reservas",
      rows: [
        [
          "Arquivo",
          "Aba",
          "Linha",
          "Servico",
          "Tutor",
          "Pets",
          "Data",
          "Horario",
          "Valor",
          "Forma pagamento origem",
          "Status reserva sugerido",
          "Status pagamento sugerido",
          "Status staging",
          "Confianca",
        ],
        ...reservations,
      ],
      widths: [34, 18, 10, 24, 30, 34, 14, 18, 14, 26, 24, 24, 18, 12],
      freezeHeader: true,
      autofilter: true,
    },
    {
      name: "Financeiro",
      rows: [
        [
          "Arquivo",
          "Aba",
          "Linha",
          "Categoria",
          "Data",
          "Valor",
          "Destino no sistema",
          "Status staging",
          "Confianca",
          "Payload bruto",
        ],
        ...finance,
      ],
      widths: [34, 18, 10, 28, 18, 14, 30, 18, 12, 82],
      freezeHeader: true,
      autofilter: true,
    },
    {
      name: "Precos e Taxi",
      rows: [
        [
          "Arquivo",
          "Aba",
          "Linha",
          "Tipo",
          "Servico ou regra",
          "Detalhes",
          "PIX ou taxa fixa",
          "Cartao",
          "Alta temp PIX",
          "Alta temp cartao",
          "Valor por km",
          "Higienizacao",
          "Status staging",
          "Confianca",
        ],
        ...prices,
      ],
      widths: [34, 18, 10, 18, 30, 34, 18, 14, 18, 18, 16, 16, 18, 12],
      freezeHeader: true,
      autofilter: true,
    },
    {
      name: "Registros Brutos",
      rows: [
        [
          "Arquivo",
          "Origem",
          "Aba",
          "Linha",
          "Bloco",
          "Tipo detectado",
          "Status staging",
          "Confianca",
          "Payload normalizado",
          "Payload bruto",
        ],
        ...raw,
      ],
      widths: [34, 18, 18, 10, 10, 24, 18, 12, 82, 82],
      freezeHeader: true,
      autofilter: true,
    },
  ];
}

function countByType(batch: ImportBatchDraft, type: ImportDetectedType) {
  return batch.records.filter((record) => record.detectedType === type).length;
}

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function cellRef(rowIndex: number, colIndex: number) {
  return `${colName(colIndex)}${rowIndex + 1}`;
}

function sheetXml(sheet: WorkbookSheet) {
  const maxCols = Math.max(...sheet.rows.map((row) => row.length), 1);
  const lastCell = `${colName(maxCols - 1)}${Math.max(sheet.rows.length, 1)}`;
  const cols = Array.from({ length: maxCols }, (_, index) => {
    const width = sheet.widths?.[index] ?? 18;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");

  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = Array.from({ length: maxCols }, (_, colIndex) =>
        cellXml(row[colIndex] ?? "", rowIndex, colIndex),
      ).join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  const freeze = sheet.freezeHeader
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';

  const autoFilter = sheet.autofilter && sheet.rows.length > 1 ? `<autoFilter ref="A1:${lastCell}"/>` : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${freeze}
<cols>${cols}</cols>
<sheetData>${rows}</sheetData>
${autoFilter}
</worksheet>`;
}

function cellXml(value: string | number | boolean | null, rowIndex: number, colIndex: number) {
  const ref = cellRef(rowIndex, colIndex);
  const style = rowIndex === 0 ? 1 : 0;

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }

  if (typeof value === "boolean") {
    return `<c r="${ref}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  const text = String(value ?? "").slice(0, 32_000);
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
}

function workbookXml(sheets: WorkbookSheet[]) {
  const sheetEntries = sheets
    .map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetEntries}</sheets>
</workbook>`;
}

function workbookRelsXml(sheets: WorkbookSheet[]) {
  const sheetRels = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");
  const stylesId = sheets.length + 1;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetRels}
<Relationship Id="rId${stylesId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function contentTypesXml(sheets: WorkbookSheet[]) {
  const sheetOverrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheetOverrides}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="10"/><name val="Aptos"/></font>
<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF155E63"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function coreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Auditoria de importacao Zeni Pets</dc:title>
<dc:creator>Codex</dc:creator>
<cp:lastModifiedBy>Codex</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
<dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

function appXml(sheets: WorkbookSheet[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>Microsoft Excel</Application>
<DocSecurity>0</DocSecurity>
<ScaleCrop>false</ScaleCrop>
<HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
<TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map((sheet) => `<vt:lpstr>${xmlEscape(sheet.name)}</vt:lpstr>`).join("")}</vt:vector></TitlesOfParts>
</Properties>`;
}

async function writeXlsx(sheets: WorkbookSheet[]) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml(sheets));
  zip.folder("_rels")!.file(".rels", rootRelsXml());
  zip.folder("docProps")!.file("core.xml", coreXml());
  zip.folder("docProps")!.file("app.xml", appXml(sheets));
  zip.folder("xl")!.file("workbook.xml", workbookXml(sheets));
  zip.folder("xl")!.file("styles.xml", stylesXml());
  zip.folder("xl")!.folder("_rels")!.file("workbook.xml.rels", workbookRelsXml(sheets));
  const worksheets = zip.folder("xl")!.folder("worksheets")!;
  sheets.forEach((sheet, index) => worksheets.file(`sheet${index + 1}.xml`, sheetXml(sheet)));

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  await fs.writeFile(OUTPUT_FILE, buffer);
}

async function verifyXlsx() {
  const data = await fs.readFile(OUTPUT_FILE);
  const zip = await JSZip.loadAsync(data);
  const required = [
    "[Content_Types].xml",
    "_rels/.rels",
    "xl/workbook.xml",
    "xl/styles.xml",
    "xl/worksheets/sheet1.xml",
  ];
  const missing = required.filter((file) => !zip.file(file));
  if (missing.length) {
    throw new Error(`Arquivo XLSX invalido. Faltando: ${missing.join(", ")}`);
  }

  const workbook = await zip.file("xl/workbook.xml")!.async("text");
  if (!workbook.includes("Conflitos Tutores") || !workbook.includes("Registros Brutos")) {
    throw new Error("Arquivo XLSX gerado sem as abas esperadas.");
  }
}

async function main() {
  const batches = await parseProjectDiagnostics(process.cwd());
  const sheets = buildSheets(batches);
  await writeXlsx(sheets);
  await verifyXlsx();

  console.log(`Relatorio gerado: ${OUTPUT_FILE}`);
  console.log(`Abas: ${sheets.map((sheet) => sheet.name).join(", ")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
