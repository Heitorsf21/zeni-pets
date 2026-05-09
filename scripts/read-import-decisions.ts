import fs from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

const AUDIT_WORKBOOK = path.join(
  process.cwd(),
  "outputs",
  "import-audit",
  "zeni-pets-auditoria-importacao.xlsx",
);
const OUTPUT_DIR = path.join(process.cwd(), "outputs", "import-audit");
const DECISIONS_JSON = path.join(OUTPUT_DIR, "import-decisions.json");
const DECISIONS_SUMMARY = path.join(OUTPUT_DIR, "import-decisions-summary.md");

type SheetName = "Conflitos Tutores" | "Sugestoes Pets" | "Tutores Candidatos";
type RowObject = Record<string, string>;
type WorkbookRows = Map<string, string[][]>;
type DecisionSource = "sheet" | "chat-override";
type DecisionAction =
  | "MERGE"
  | "APPROVE"
  | "CORRECT"
  | "SEPARATE"
  | "REJECT"
  | "REVIEW"
  | "NOTE"
  | "PENDING";

type TutorDecision = {
  rowNumber: number;
  suggestedDecision: string;
  finalDecision: string;
  decisionSource: DecisionSource;
  action: DecisionAction;
  tutorLabel: string;
  aliases: string[];
  referencedAliases: string[];
  petsMentioned: string[];
  origins: string;
};

type PetDecision = {
  rowNumber: number;
  suggestedDecision: string;
  finalDecision: string;
  decisionSource: DecisionSource;
  action: DecisionAction;
  tutorLabel: string;
  canonicalTutorName: string;
  petLabel: string;
  canonicalPetName: string;
  origins: string;
};

type MergeGroup = {
  canonicalName: string;
  aliases: string[];
  reasons: string[];
};

type SimilarTutorCandidate = {
  nameA: string;
  nameB: string;
  score: number;
  status: "already-decided" | "review-only";
};

const CHAT_OVERRIDES = [
  {
    sheet: "Conflitos Tutores" satisfies SheetName,
    tutor: "Camila Figueiredo",
    decision: "MESCLAR",
  },
  {
    sheet: "Conflitos Tutores" satisfies SheetName,
    tutor: "Maria Helena",
    decision: "MESCLAR",
  },
  {
    sheet: "Sugestoes Pets" satisfies SheetName,
    tutor: "Camila Figueiredo",
    pet: "Carlota",
    decision: "MESCLAR",
  },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  textNodeName: "#text",
  removeNSPrefix: true,
});

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function compact(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function removeCadastroMarker(value: string) {
  return value
    .replace(/\((?:cadastrad[ao])\)/gi, "")
    .replace(/\b(?:cadastrad[ao])\b/gi, "")
    .replace(/[!]+/g, "")
    .trim();
}

function cleanDisplayName(value: unknown) {
  return compact(removeCadastroMarker(String(value ?? "")))
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeNameKey(value: unknown) {
  return stripDiacritics(cleanDisplayName(value))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value: unknown) {
  return stripDiacritics(compact(value))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]) {
  return [...new Set(values.map(cleanDisplayName).filter(Boolean))];
}

function splitAliases(label: string) {
  return unique(label.split("|").map((item) => item.trim()));
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

function columnIndexFromRef(ref: string) {
  const letters = ref.match(/[A-Z]+/)?.[0] ?? "A";
  return letters.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function readSharedStrings(zip: JSZip) {
  const xml = await zip.file("xl/sharedStrings.xml")?.async("text");
  if (!xml) return [];
  const parsed = parser.parse(xml);
  return asArray(parsed.sst?.si).map((item) => collectText(item));
}

function readCellValue(cell: Record<string, unknown>, sharedStrings: string[]) {
  const type = String(cell["@_t"] ?? "");
  if (type === "s") {
    const index = Number(cell.v ?? 0);
    return sharedStrings[index] ?? "";
  }
  if (type === "inlineStr") return collectText(cell.is);
  if (type === "str") return compact(cell.v);
  if (cell.v == null) return "";
  return String(cell.v);
}

function readWorksheetRows(parsedSheet: unknown, sharedStrings: string[]) {
  const sheet = parsedSheet as { worksheet?: { sheetData?: { row?: unknown } } };
  const rows = asArray(sheet.worksheet?.sheetData?.row);

  return rows
    .map((row) => {
      const output: string[] = [];
      for (const cell of asArray((row as { c?: unknown }).c)) {
        const record = cell as Record<string, unknown>;
        output[columnIndexFromRef(String(record["@_r"] ?? ""))] = compact(
          readCellValue(record, sharedStrings),
        );
      }
      return output;
    })
    .filter((row) => row.some(Boolean));
}

async function readWorkbookRows(filePath: string): Promise<WorkbookRows> {
  const zip = await JSZip.loadAsync(await fs.readFile(filePath));
  const sharedStrings = await readSharedStrings(zip);
  const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  if (!workbookXml || !relsXml) {
    throw new Error(`Workbook invalido: ${filePath}`);
  }

  const workbook = parser.parse(workbookXml);
  const rels = parser.parse(relsXml);
  const relTargetById = new Map(
    asArray(rels.Relationships?.Relationship).map((relationship) => [
      String((relationship as Record<string, unknown>)["@_Id"]),
      String((relationship as Record<string, unknown>)["@_Target"]),
    ]),
  );

  const result: WorkbookRows = new Map();
  for (const sheet of asArray(workbook.workbook?.sheets?.sheet)) {
    const sheetRecord = sheet as Record<string, unknown>;
    const name = String(sheetRecord["@_name"]);
    const relationshipId = String(sheetRecord["@_id"]);
    const target = relTargetById.get(relationshipId);
    if (!target) continue;

    const xmlPath = target.startsWith("/")
      ? target.slice(1)
      : `xl/${target.replace(/^\/+/, "")}`;
    const xml = await zip.file(xmlPath)?.async("text");
    if (!xml) continue;
    result.set(name, readWorksheetRows(parser.parse(xml), sharedStrings));
  }

  return result;
}

function rowsToObjects(rows: string[][]): RowObject[] {
  const headers = rows[0] ?? [];
  const normalizedHeaders = headers.map(normalizeHeader);

  return rows.slice(1).map((row, index) => {
    const object: RowObject = { __rowNumber: String(index + 2) };
    normalizedHeaders.forEach((header, columnIndex) => {
      object[header] = row[columnIndex] ?? "";
    });
    return object;
  });
}

function field(row: RowObject, header: string) {
  return row[normalizeHeader(header)] ?? "";
}

function getOverride(sheet: SheetName, row: RowObject) {
  const tutor = normalizeNameKey(field(row, "Tutor"));
  const pet = normalizeNameKey(field(row, "Pet(s)"));

  return CHAT_OVERRIDES.find((override) => {
    if (override.sheet !== sheet) return false;
    if (normalizeNameKey(override.tutor) !== tutor) return false;
    if ("pet" in override && normalizeNameKey(override.pet) !== pet) return false;
    return true;
  });
}

function finalDecisionFor(sheet: SheetName, row: RowObject) {
  const sheetDecision = compact(field(row, "Decisao Final"));
  if (sheetDecision) {
    return { decision: sheetDecision, source: "sheet" as DecisionSource };
  }

  const override = getOverride(sheet, row);
  if (override) {
    return { decision: override.decision, source: "chat-override" as DecisionSource };
  }

  return { decision: "", source: "sheet" as DecisionSource };
}

function classifyDecision(
  suggestedDecision: string,
  finalDecision: string,
  defaultMergeWhenSuggested: boolean,
): DecisionAction {
  const suggested = normalizeHeader(suggestedDecision);
  const decision = normalizeHeader(finalDecision);

  if (!decision) return "PENDING";
  if (decision.includes("rejeit")) return "REJECT";
  if (decision.includes("separ")) return "SEPARATE";
  if (decision.includes("validar")) return "REVIEW";
  if (decision.includes("nome correto") || decision.includes("corrig")) return "CORRECT";
  if (
    decision.includes("mescl") ||
    decision.includes("mesma pessoa") ||
    decision.includes("mesmo tutor") ||
    decision.includes("sao a mesma") ||
    decision.includes("e a mesma")
  ) {
    return "MERGE";
  }
  if (defaultMergeWhenSuggested && suggested.includes("mesclar")) return "MERGE";
  if (decision.includes("aprovar")) return "APPROVE";
  return "NOTE";
}

function classifyPetDecision(suggestedDecision: string, finalDecision: string) {
  const decision = normalizeHeader(finalDecision);
  if (!decision) return "PENDING";
  if (decision.includes("nome correto do pet")) return "CORRECT";
  return classifyDecision(suggestedDecision, finalDecision, true);
}

function knownAliasesFromRows(rows: RowObject[]) {
  const names = new Map<string, string>();

  for (const row of rows) {
    for (const alias of splitAliases(field(row, "Tutor"))) {
      names.set(normalizeNameKey(alias), alias);
    }
  }

  return [...names.values()].sort((a, b) => b.length - a.length);
}

function aliasesReferencedInDecision(decision: string, knownAliases: string[]) {
  const decisionKey = normalizeNameKey(decision);
  const matches = knownAliases.filter((alias) => {
    const aliasKey = normalizeNameKey(alias);
    return aliasKey.length >= 5 && decisionKey.includes(aliasKey);
  });

  const afterCom = decision.match(/\bcom\s+(.+)$/i)?.[1];
  if (afterCom) matches.push(afterCom);

  return unique(matches);
}

function buildCanonicalTutorHints(input: {
  tutorRows: RowObject[];
  petRows: RowObject[];
  knownAliases: string[];
}) {
  const hints = new Map<string, string>();
  const rows = [
    ...input.tutorRows.map((row) => ({ sheet: "Conflitos Tutores" as SheetName, row })),
    ...input.petRows.map((row) => ({ sheet: "Sugestoes Pets" as SheetName, row })),
  ];

  for (const item of rows) {
    const { decision } = finalDecisionFor(item.sheet, item.row);
    const normalizedDecision = normalizeHeader(decision);
    if (!normalizedDecision.includes("nome correto")) continue;
    if (normalizedDecision.includes("nome correto do pet")) continue;

    const match = decision.match(/nome correto\s+(?:e\s+|é\s+)?([^.;,]+)$/i);
    const canonical = cleanDisplayName(match?.[1] ?? "");
    if (!canonical) continue;

    const referenced = unique([
      ...splitAliases(field(item.row, "Tutor")),
      ...aliasesReferencedInDecision(decision, input.knownAliases),
      canonical,
    ]);

    for (const alias of referenced) {
      const key = normalizeNameKey(alias);
      if (key) hints.set(key, canonical);
    }
  }

  return hints;
}

function extractCorrectPetName(decision: string, currentPet: string) {
  const match = decision.match(/nome correto(?: do pet)?\s+e\s+(.+)$/i);
  if (!match) return cleanDisplayName(currentPet);
  return cleanDisplayName(match[1].replace(/[.;].*$/g, ""));
}

function chooseCanonicalName(aliases: string[]) {
  const cleaned = unique(aliases);
  const withCadastroHint = aliases.find((alias) => /\bcadastrad[ao]\b/i.test(alias));
  if (withCadastroHint) return cleanDisplayName(withCadastroHint);

  return cleaned.sort((a, b) => {
    const tokenDiff = b.split(/\s+/).length - a.split(/\s+/).length;
    return tokenDiff || b.length - a.length;
  })[0] ?? "";
}

class UnionFind {
  private parent = new Map<string, string>();

  add(item: string) {
    if (!this.parent.has(item)) this.parent.set(item, item);
  }

  find(item: string): string {
    this.add(item);
    const parent = this.parent.get(item)!;
    if (parent === item) return item;
    const root = this.find(parent);
    this.parent.set(item, root);
    return root;
  }

  union(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootB, rootA);
  }

  groups() {
    const groups = new Map<string, string[]>();
    for (const item of this.parent.keys()) {
      const root = this.find(item);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root)!.push(item);
    }
    return [...groups.values()];
  }
}

function buildTutorDecisions(rows: RowObject[], knownAliases: string[]) {
  return rows.map<TutorDecision>((row) => {
    const { decision, source } = finalDecisionFor("Conflitos Tutores", row);
    const suggestedDecision = field(row, "Decisao sugerida");
    const action = classifyDecision(suggestedDecision, decision, true);
    const aliases = splitAliases(field(row, "Tutor"));
    const referencedAliases = action === "MERGE"
      ? aliasesReferencedInDecision(decision, knownAliases)
      : [];

    return {
      rowNumber: Number(row.__rowNumber),
      suggestedDecision,
      finalDecision: decision,
      decisionSource: source,
      action,
      tutorLabel: field(row, "Tutor"),
      aliases,
      referencedAliases,
      petsMentioned: splitAliases(field(row, "Pets")),
      origins: field(row, "Origens"),
    };
  });
}

function buildTutorMergeGroups(decisions: TutorDecision[], canonicalHints: Map<string, string>) {
  const union = new UnionFind();
  const aliasByKey = new Map<string, string>();
  const reasonsByKey = new Map<string, string[]>();

  function addAlias(alias: string, reason: string) {
    const key = normalizeNameKey(alias);
    if (!key) return "";
    union.add(key);
    aliasByKey.set(key, cleanDisplayName(alias));
    if (!reasonsByKey.has(key)) reasonsByKey.set(key, []);
    reasonsByKey.get(key)!.push(reason);
    return key;
  }

  for (const decision of decisions) {
    const shouldMerge =
      decision.action === "MERGE" ||
      (decision.action === "APPROVE" &&
        normalizeHeader(decision.suggestedDecision).includes("mesclar"));
    if (!shouldMerge) continue;

    const reason = `${decision.tutorLabel}: ${decision.finalDecision || decision.suggestedDecision}`;
    const keys = [...decision.aliases, ...decision.referencedAliases]
      .map((alias) => addAlias(alias, reason))
      .filter(Boolean);

    if (keys.length === 1) {
      union.add(keys[0]);
      continue;
    }

    for (const key of keys.slice(1)) {
      union.union(keys[0], key);
    }
  }

  return union.groups().map<MergeGroup>((group) => {
    const aliases = unique(group.map((key) => aliasByKey.get(key) ?? key));
    const reasons = unique(group.flatMap((key) => reasonsByKey.get(key) ?? []));
    const canonicalHint = group.map((key) => canonicalHints.get(key)).find(Boolean);
    return {
      canonicalName: canonicalHint ?? chooseCanonicalName(aliases),
      aliases,
      reasons,
    };
  });
}

function resolveCanonicalTutorName(name: string, mergeGroups: MergeGroup[]) {
  const key = normalizeNameKey(name);
  const group = mergeGroups.find((item) =>
    item.aliases.some((alias) => normalizeNameKey(alias) === key),
  );
  return group?.canonicalName ?? cleanDisplayName(name);
}

function buildPetDecisions(rows: RowObject[], mergeGroups: MergeGroup[]) {
  return rows.map<PetDecision>((row) => {
    const { decision, source } = finalDecisionFor("Sugestoes Pets", row);
    const suggestedDecision = field(row, "Decisao sugerida");
    const petLabel = field(row, "Pet(s)");
    const action = classifyPetDecision(suggestedDecision, decision);

    return {
      rowNumber: Number(row.__rowNumber),
      suggestedDecision,
      finalDecision: decision,
      decisionSource: source,
      action,
      tutorLabel: field(row, "Tutor"),
      canonicalTutorName: resolveCanonicalTutorName(field(row, "Tutor"), mergeGroups),
      petLabel,
      canonicalPetName: action === "CORRECT" ? extractCorrectPetName(decision, petLabel) : cleanDisplayName(petLabel),
      origins: field(row, "Origens"),
    };
  });
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

function likelySameTutorName(a: string, b: string) {
  const aKey = normalizeNameKey(a);
  const bKey = normalizeNameKey(b);
  if (!aKey || !bKey || aKey === bKey) return false;

  const aTokens = aKey.split(" ");
  const bTokens = bKey.split(" ");
  if (aTokens[0] !== bTokens[0]) return false;

  const wholeScore = similarity(aKey, bKey);
  const lastScore = similarity(aTokens.at(-1) ?? "", bTokens.at(-1) ?? "");
  const commonTokens = aTokens.filter((token) => bTokens.includes(token)).length;

  return wholeScore >= 0.9 || (commonTokens >= Math.min(aTokens.length, bTokens.length) - 1 && lastScore >= 0.82);
}

function buildSimilarTutorCandidates(rows: RowObject[], mergeGroups: MergeGroup[]) {
  const names = unique(rows.map((row) => field(row, "Tutor")).flatMap(splitAliases));
  const decidedPairs = new Set<string>();
  const candidates: SimilarTutorCandidate[] = [];

  for (const group of mergeGroups) {
    for (const aliasA of group.aliases) {
      for (const aliasB of group.aliases) {
        decidedPairs.add(pairKey(aliasA, aliasB));
      }
    }
  }

  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      if (!likelySameTutorName(names[i], names[j])) continue;
      const score = Number(similarity(normalizeNameKey(names[i]), normalizeNameKey(names[j])).toFixed(2));
      candidates.push({
        nameA: names[i],
        nameB: names[j],
        score,
        status: decidedPairs.has(pairKey(names[i], names[j])) ? "already-decided" : "review-only",
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score || a.nameA.localeCompare(b.nameA));
}

function pairKey(a: string, b: string) {
  return [normalizeNameKey(a), normalizeNameKey(b)].sort().join("::");
}

function ensureNoPending(tutorDecisions: TutorDecision[], petDecisions: PetDecision[]) {
  const pendingTutors = tutorDecisions.filter((decision) => decision.action === "PENDING");
  const pendingPets = petDecisions.filter((decision) => decision.action === "PENDING");
  return { pendingTutors, pendingPets };
}

function decisionCounts<T extends { action: DecisionAction }>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item.action] = (acc[item.action] ?? 0) + 1;
    return acc;
  }, {});
}

async function writeOutputs(payload: unknown, summary: string) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(DECISIONS_JSON, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(DECISIONS_SUMMARY, summary, "utf8");
}

function markdownSummary(input: {
  tutorDecisions: TutorDecision[];
  petDecisions: PetDecision[];
  mergeGroups: MergeGroup[];
  similarTutorCandidates: SimilarTutorCandidate[];
}) {
  const pending = ensureNoPending(input.tutorDecisions, input.petDecisions);
  const lines = [
    "# Decisoes oficiais de importacao",
    "",
    `Gerado em: ${new Date().toISOString()}`,
    `Planilha origem: ${AUDIT_WORKBOOK}`,
    "",
    "## Totais",
    "",
    `- Decisoes de tutores: ${input.tutorDecisions.length}`,
    `- Decisoes de pets: ${input.petDecisions.length}`,
    `- Grupos oficiais de mesclagem de tutores: ${input.mergeGroups.length}`,
    `- Pendencias de tutores: ${pending.pendingTutors.length}`,
    `- Pendencias de pets: ${pending.pendingPets.length}`,
    "",
    "## Acoes por tutores",
    "",
    ...Object.entries(decisionCounts(input.tutorDecisions)).map(
      ([action, count]) => `- ${action}: ${count}`,
    ),
    "",
    "## Acoes por pets",
    "",
    ...Object.entries(decisionCounts(input.petDecisions)).map(
      ([action, count]) => `- ${action}: ${count}`,
    ),
    "",
    "## Mesclagens oficiais de tutores",
    "",
    ...input.mergeGroups.map(
      (group) => `- ${group.canonicalName}: ${group.aliases.join(" | ")}`,
    ),
    "",
    "## Nomes parecidos detectados",
    "",
    ...input.similarTutorCandidates.map(
      (candidate) =>
        `- ${candidate.status}: ${candidate.nameA} <> ${candidate.nameB} (${candidate.score})`,
    ),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

async function main() {
  const workbookRows = await readWorkbookRows(AUDIT_WORKBOOK);
  const tutorRows = rowsToObjects(workbookRows.get("Conflitos Tutores") ?? []);
  const petRows = rowsToObjects(workbookRows.get("Sugestoes Pets") ?? []);
  const tutorCandidateRows = rowsToObjects(workbookRows.get("Tutores Candidatos") ?? []);

  const knownAliases = knownAliasesFromRows([...tutorRows, ...tutorCandidateRows]);
  const canonicalTutorHints = buildCanonicalTutorHints({ tutorRows, petRows, knownAliases });
  const tutorDecisions = buildTutorDecisions(tutorRows, knownAliases);
  const tutorMergeGroups = buildTutorMergeGroups(tutorDecisions, canonicalTutorHints);
  const petDecisions = buildPetDecisions(petRows, tutorMergeGroups);
  const similarTutorCandidates = buildSimilarTutorCandidates(
    tutorCandidateRows.length ? tutorCandidateRows : tutorRows,
    tutorMergeGroups,
  );
  const pending = ensureNoPending(tutorDecisions, petDecisions);

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceWorkbook: AUDIT_WORKBOOK,
    chatOverridesApplied: CHAT_OVERRIDES,
    tutorDecisions,
    petDecisions,
    tutorMergeGroups,
    similarTutorCandidates,
    pending,
  };

  await writeOutputs(payload, markdownSummary({
    tutorDecisions,
    petDecisions,
    mergeGroups: tutorMergeGroups,
    similarTutorCandidates,
  }));

  console.log(`Decisoes oficiais: ${DECISIONS_JSON}`);
  console.log(`Resumo: ${DECISIONS_SUMMARY}`);
  console.log(`Mesclagens de tutores: ${tutorMergeGroups.length}`);
  console.log(`Pendencias: ${pending.pendingTutors.length + pending.pendingPets.length}`);

  if (pending.pendingTutors.length || pending.pendingPets.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
