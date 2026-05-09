import path from "node:path";
import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import mammoth from "mammoth";
import { parseCurrencyToCents } from "@/lib/money";

export type ImportSourceKind =
  | "PRICE_SHEET"
  | "CLIENTS_2025"
  | "CLIENTS_2026"
  | "CLIENT_FORM_DOCX"
  | "UNKNOWN";

export type ImportDetectedType =
  | "SERVICE_PRICE"
  | "TAXI_RULE"
  | "HISTORICAL_RESERVATION"
  | "DAYCARE_RESERVATION"
  | "FINANCIAL_ENTRY"
  | "FINANCIAL_SUMMARY"
  | "CLIENT_FORM"
  | "UNKNOWN";

export type ImportRecordDraft = {
  sourceSheet?: string;
  sourceRow?: number;
  sourceBlock?: number;
  rawPayload: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
  detectedType: ImportDetectedType;
  confidence: number;
  status: "PENDING_REVIEW" | "NEEDS_REVIEW";
};

export type ImportBatchDraft = {
  fileName: string;
  sourceKind: ImportSourceKind;
  records: ImportRecordDraft[];
};

function detectSourceKind(filePath: string): ImportSourceKind {
  const name = path.basename(filePath).toLowerCase();
  if (name.includes("valores")) return "PRICE_SHEET";
  if (name.includes("2025")) return "CLIENTS_2025";
  if (name.includes("2026")) return "CLIENTS_2026";
  if (name.endsWith(".docx")) return "CLIENT_FORM_DOCX";
  return "UNKNOWN";
}

type SimpleWorkbook = {
  sheetNames: string[];
  sheets: Record<string, unknown[][]>;
};

function headerRow(row: unknown[]) {
  return row.map((cell) => String(cell).trim());
}

function rowObject(headers: string[], row: unknown[]) {
  return headers.reduce<Record<string, unknown>>((acc, header, index) => {
    if (header) acc[header] = row[index] ?? "";
    return acc;
  }, {});
}

function excelSerialToIso(serial: number) {
  const excelEpoch = Date.UTC(1899, 11, 30);
  return new Date(excelEpoch + serial * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeDateValue(value: unknown) {
  if (typeof value === "number") return excelSerialToIso(value);
  const text = String(value ?? "").trim();
  return text || null;
}

function isTotalRow(row: Record<string, unknown>) {
  return Object.values(row).some((value) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .startsWith("total"),
  );
}

function totalRowLabel(row: Record<string, unknown>) {
  return (
    Object.values(row)
      .map((value) => String(value ?? "").trim())
      .find((value) => value.toLowerCase().startsWith("total")) ?? "Total"
  );
}

function totalRowAmountCents(row: Record<string, unknown>) {
  for (const value of Object.values(row).reverse()) {
    const cents = parseCurrencyToCents(value);
    if (cents != null) return cents;
  }
  return null;
}

function parsePriceSheet(fileName: string, workbook: SimpleWorkbook): ImportBatchDraft {
  const sheetName = workbook.sheetNames[0];
  const rows = workbook.sheets[sheetName];
  const records: ImportRecordDraft[] = [];
  const headers = headerRow(rows[0] ?? []);
  let inTaxiSection = false;

  rows.slice(1).forEach((row, offset) => {
    const sourceRow = offset + 2;
    const firstCell = String(row[0] ?? "").trim();
    if (!firstCell) return;
    if (firstCell.toLowerCase().includes("tipo de deslocamento")) {
      inTaxiSection = true;
      return;
    }

    if (inTaxiSection) {
      const raw = {
        tipo: row[0] ?? "",
        taxaFixa: row[1] ?? "",
        valorPorKm: row[2] ?? "",
        adicionalHigienizacao: row[3] ?? "",
      };
      records.push({
        sourceSheet: sheetName,
        sourceRow,
        rawPayload: raw,
        normalizedPayload: {
          name: raw.tipo,
          fixedFeeCents: parseCurrencyToCents(raw.taxaFixa),
          perKmCents: parseCurrencyToCents(raw.valorPorKm),
          hygieneFeeCents: parseCurrencyToCents(raw.adicionalHigienizacao),
        },
        detectedType: "TAXI_RULE",
        confidence: 0.88,
        status: "PENDING_REVIEW",
      });
      return;
    }

    const raw = rowObject(headers, row);
    records.push({
      sourceSheet: sheetName,
      sourceRow,
      rawPayload: raw,
      normalizedPayload: {
        service: raw["SERVIÇO"],
        details: raw["DETALHES"],
        cardCents: parseCurrencyToCents(raw["CARTÃO"]),
        pixCents: parseCurrencyToCents(raw["PIX"]),
        highSeasonCardCents: parseCurrencyToCents(raw["ALTA TEMP (CARTÃO)"]),
        highSeasonPixCents: parseCurrencyToCents(raw["ALTA TEMP (PIX)"]),
      },
      detectedType: "SERVICE_PRICE",
      confidence: 0.92,
      status: "PENDING_REVIEW",
    });
  });

  return { fileName, sourceKind: "PRICE_SHEET", records };
}

function parseOperationalWorkbook(
  fileName: string,
  sourceKind: ImportSourceKind,
  workbook: SimpleWorkbook,
): ImportBatchDraft {
  const records: ImportRecordDraft[] = [];

  workbook.sheetNames.forEach((sheetName) => {
    const rows = workbook.sheets[sheetName];
    const headers = headerRow(rows[0] ?? []);
    const normalizedSheet = sheetName.toLowerCase();

    rows.slice(1).forEach((row, offset) => {
      const sourceRow = offset + 2;
      const raw = rowObject(headers, row);
      if (!Object.values(raw).some((value) => String(value ?? "").trim())) return;
      if (isTotalRow(raw)) {
        records.push({
          sourceSheet: sheetName,
          sourceRow,
          rawPayload: raw,
          normalizedPayload: {
            label: totalRowLabel(raw),
            sheetName,
            amountCents: totalRowAmountCents(raw),
          },
          detectedType: "FINANCIAL_SUMMARY",
          confidence: totalRowAmountCents(raw) != null ? 0.8 : 0.45,
          status: totalRowAmountCents(raw) != null ? "PENDING_REVIEW" : "NEEDS_REVIEW",
        });
        return;
      }

      if (normalizedSheet.includes("cliente")) {
        records.push({
          sourceSheet: sheetName,
          sourceRow,
          rawPayload: raw,
          normalizedPayload: {
            tutorName: raw["Nome do Cliente"],
            service: raw["Serviço"],
            period: normalizeDateValue(raw["Data"]),
            pets: raw["Nome do Pet"],
            amountCents: parseCurrencyToCents(raw["Valor"]),
            payment: raw["Forma de pagamento"],
          },
          detectedType: "HISTORICAL_RESERVATION",
          confidence: 0.82,
          status: "PENDING_REVIEW",
        });
        return;
      }

      if (normalizedSheet.includes("creche")) {
        const schedule = String(raw["Horário"] ?? "").trim();
        records.push({
          sourceSheet: sheetName,
          sourceRow,
          rawPayload: raw,
          normalizedPayload: {
            tutorName: raw["Nome do cliente"],
            petName: raw["Nome do pet"],
            date: normalizeDateValue(raw["Data"]),
            schedule,
            amountCents: parseCurrencyToCents(raw["Valor"]),
            payment: raw["Forma de Pagamento"],
          },
          detectedType: "DAYCARE_RESERVATION",
          confidence: schedule.includes("as") && !schedule.endsWith("as") ? 0.86 : 0.55,
          status: schedule.includes("as") && !schedule.endsWith("as")
            ? "PENDING_REVIEW"
            : "NEEDS_REVIEW",
        });
        return;
      }

      records.push({
        sourceSheet: sheetName,
        sourceRow,
        rawPayload: raw,
        normalizedPayload: {
          category: raw["Categoria"],
          date: normalizeDateValue(raw["Data"]),
          amountCents: parseCurrencyToCents(raw["Valor"]),
        },
        detectedType: "FINANCIAL_ENTRY",
        confidence: 0.76,
        status: "PENDING_REVIEW",
      });
    });
  });

  return { fileName, sourceKind, records };
}

function extractLabel(lines: string[], label: string) {
  const prefix = `${label}:`;
  return (
    lines
      .find((line) => line.toLowerCase().startsWith(prefix.toLowerCase()))
      ?.slice(prefix.length)
      .trim() ?? ""
  );
}

function extractRepeatedLabel(lines: string[], label: string) {
  const prefix = `${label}:`;
  return lines
    .filter((line) => line.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((line) => line.slice(prefix.length).trim());
}

export async function parseDocxForStaging(filePath: string): Promise<ImportBatchDraft> {
  let lines = await readDocxLinesFromXml(filePath);
  if (!lines.length) {
    const result = await mammoth.extractRawText({ path: filePath });
    lines = result.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (line.toLowerCase().startsWith("nome do tutor:") && current.length) {
      blocks.push(current);
      current = [];
    }
    if (line.toLowerCase() !== "zeni pets (clientes)") current.push(line);
  }
  if (current.length) blocks.push(current);

  const records = blocks
    .filter((block) => block.some((line) => line.toLowerCase().startsWith("nome do tutor:")))
    .map<ImportRecordDraft>((block, index) => {
      const tutorName = extractLabel(block, "Nome do tutor");
      const pets = extractRepeatedLabel(block, "Nome do pet");
      const hasPetData = pets.some(Boolean);
      const rawPayload = { lines: block };

      return {
        sourceBlock: index + 1,
        rawPayload,
        normalizedPayload: {
          tutorName,
          document: extractLabel(block, "CPF ou RG"),
          address: extractLabel(block, "Endereço"),
          cep: extractLabel(block, "CEP"),
          birthDate: extractLabel(block, "Data de Nascimento"),
          phone: extractLabel(block, "Telefone"),
          email: extractLabel(block, "E-mail"),
          pets,
          service: extractLabel(block, "Serviço"),
          schedule: extractLabel(block, "Programação"),
          values: extractLabel(block, "Valores"),
          notes: extractLabel(block, "Observações"),
          deliveredItems:
            extractLabel(block, "Itens entregues com o pet") ||
            extractLabel(block, "Itens entregues com os pets"),
        },
        detectedType: "CLIENT_FORM",
        confidence: tutorName && hasPetData ? 0.84 : 0.35,
        status: tutorName && hasPetData ? "PENDING_REVIEW" : "NEEDS_REVIEW",
      };
    });

  return {
    fileName: path.basename(filePath),
    sourceKind: "CLIENT_FORM_DOCX",
    records,
  };
}

async function readDocxLinesFromXml(filePath: string) {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const documentXml = await zip.file("word/document.xml")?.async("text");
  if (!documentXml) return [];

  const parser = new XMLParser({
    ignoreAttributes: false,
    textNodeName: "#text",
    removeNSPrefix: true,
  });
  const parsed = parser.parse(documentXml);
  const body = parsed?.document?.body;
  const paragraphs = Array.isArray(body?.p) ? body.p : body?.p ? [body.p] : [];

  return paragraphs
    .map((paragraph: unknown) => collectText(paragraph).trim())
    .filter(Boolean);
}

function collectText(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (typeof node !== "object") return "";

  const record = node as Record<string, unknown>;
  let text = typeof record.t === "string" ? record.t : collectText(record.t);
  if (record["#text"]) text += String(record["#text"]);

  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith("@_") || key === "t" || key === "#text") continue;
    text += collectText(value);
  }

  return text;
}

export async function parseFileForStaging(filePath: string): Promise<ImportBatchDraft> {
  const fileName = path.basename(filePath);
  const sourceKind = detectSourceKind(filePath);

  if (fileName.toLowerCase().endsWith(".docx")) {
    return parseDocxForStaging(filePath);
  }

  const workbook = await readXlsxWorkbook(filePath);
  if (sourceKind === "PRICE_SHEET") return parsePriceSheet(fileName, workbook);
  return parseOperationalWorkbook(fileName, sourceKind, workbook);
}

async function readXlsxWorkbook(filePath: string): Promise<SimpleWorkbook> {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const parser = new XMLParser({
    ignoreAttributes: false,
    textNodeName: "#text",
    removeNSPrefix: true,
  });

  const sharedStrings = await readSharedStrings(zip, parser);
  const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  if (!workbookXml || !relsXml) {
    throw new Error(`Invalid XLSX workbook: ${filePath}`);
  }

  const workbook = parser.parse(workbookXml);
  const rels = parser.parse(relsXml);
  const relationships = asArray(rels.Relationships?.Relationship);
  const relTargetById = new Map(
    relationships.map((relationship) => [
      String(relationship["@_Id"]),
      String(relationship["@_Target"]),
    ]),
  );

  const sheets = asArray(workbook.workbook?.sheets?.sheet);
  const sheetNames: string[] = [];
  const sheetRows: Record<string, unknown[][]> = {};

  for (const sheet of sheets) {
    const name = String(sheet["@_name"]);
    const relationshipId = String(sheet["@_id"]);
    const target = relTargetById.get(relationshipId);
    if (!target) continue;

    const normalizedTarget = target.startsWith("/")
      ? target.slice(1)
      : `xl/${target.replace(/^\/+/, "")}`;
    const xml = await zip.file(normalizedTarget)?.async("text");
    if (!xml) continue;

    sheetNames.push(name);
    sheetRows[name] = readWorksheetRows(parser.parse(xml), sharedStrings);
  }

  return { sheetNames, sheets: sheetRows };
}

async function readSharedStrings(zip: JSZip, parser: XMLParser) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("text");
  if (!xml) return [];
  const parsed = parser.parse(xml);
  return asArray(parsed.sst?.si).map((item) => collectText(item));
}

function readWorksheetRows(parsedSheet: unknown, sharedStrings: string[]) {
  const rows = asArray((parsedSheet as { worksheet?: { sheetData?: { row?: unknown } } }).worksheet?.sheetData?.row);
  const output: unknown[][] = [];

  for (const row of rows) {
    const cells = asArray((row as { c?: unknown }).c);
    const values: unknown[] = [];

    for (const cell of cells) {
      const cellRecord = cell as Record<string, unknown>;
      const ref = String(cellRecord["@_r"] ?? "");
      const colIndex = columnIndexFromRef(ref);
      const value = readCellValue(cellRecord, sharedStrings);
      values[colIndex] = value;
    }

    if (values.some((value) => String(value ?? "").trim())) output.push(values);
  }

  return output;
}

function readCellValue(cell: Record<string, unknown>, sharedStrings: string[]) {
  const type = String(cell["@_t"] ?? "");
  if (type === "s") {
    const index = Number(cell.v ?? 0);
    return sharedStrings[index] ?? "";
  }
  if (type === "inlineStr") return collectText(cell.is);

  const raw = cell.v;
  if (raw == null) return "";
  const text = String(raw);
  const numberValue = Number(text);
  return Number.isFinite(numberValue) ? numberValue : text;
}

function columnIndexFromRef(ref: string) {
  const letters = ref.match(/[A-Z]+/)?.[0] ?? "A";
  return letters.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export async function parseProjectDiagnostics(rootDir = process.cwd()) {
  const files = [
    "Planilha Valores 2026.xlsx",
    "Zeni Pets 2025.xlsx",
    "Zeni Pets 2026.xlsx",
    "Zeni Pets (Dados dos Clientes).docx",
  ];

  return Promise.all(
    files.map((file) =>
      parseFileForStaging(path.join(/* turbopackIgnore: true */ rootDir, file)),
    ),
  );
}
