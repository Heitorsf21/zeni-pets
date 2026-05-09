import fs from "node:fs/promises";
import path from "node:path";
import { parseProjectDiagnostics, type ImportRecordDraft } from "../src/lib/import/parsers";

const OUTPUT_DIR = path.join(process.cwd(), "outputs", "import-audit");
const DECISIONS_JSON = path.join(OUTPUT_DIR, "import-decisions.json");
const DRY_RUN_JSON = path.join(OUTPUT_DIR, "import-dry-run.json");
const DRY_RUN_SUMMARY = path.join(OUTPUT_DIR, "import-dry-run-summary.md");

type MergeGroup = {
  canonicalName: string;
  aliases: string[];
};

type PetDecision = {
  action: string;
  canonicalTutorName: string;
  petLabel: string;
  canonicalPetName: string;
};

type SimilarTutorCandidate = {
  nameA: string;
  nameB: string;
  score: number;
  status: "already-decided" | "review-only";
};

type DecisionsPayload = {
  tutorMergeGroups: MergeGroup[];
  petDecisions: PetDecision[];
  similarTutorCandidates: SimilarTutorCandidate[];
};

type Origin = {
  fileName: string;
  sourceKind: string;
  sourceSheet?: string;
  sourceRow?: number;
  sourceBlock?: number;
  detectedType: string;
};

type TutorDraft = {
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  birthDate?: string;
  address?: string;
  cep?: string;
  origins: Origin[];
};

type PetDraft = {
  name: string;
  tutorName: string;
  origins: Origin[];
};

type ConflictDraft = {
  type: string;
  title: string;
  description?: string;
  origins?: Origin[];
  payload?: unknown;
};

function compact(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
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

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return compact(value) || undefined;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => compact(item)).filter(Boolean);
  const text = compact(value);
  if (!text) return [];
  return text
    .split(/\s*(?:,|;|\||\s+e\s+)\s*/i)
    .map(cleanDisplayName)
    .filter(Boolean);
}

function sourceOf(batch: { fileName: string; sourceKind: string }, record: ImportRecordDraft): Origin {
  return {
    fileName: batch.fileName,
    sourceKind: batch.sourceKind,
    sourceSheet: record.sourceSheet,
    sourceRow: record.sourceRow,
    sourceBlock: record.sourceBlock,
    detectedType: record.detectedType,
  };
}

function buildTutorAliasMap(groups: MergeGroup[]) {
  const aliases = new Map<string, string>();
  for (const group of groups) {
    aliases.set(normalizeNameKey(group.canonicalName), group.canonicalName);
    for (const alias of group.aliases) {
      const key = normalizeNameKey(alias);
      if (key) aliases.set(key, group.canonicalName);
    }
  }
  return aliases;
}

function buildPetNameMap(decisions: PetDecision[]) {
  const pets = new Map<string, string>();
  for (const decision of decisions) {
    if (!["MERGE", "CORRECT", "APPROVE"].includes(decision.action)) continue;
    const key = `${normalizeNameKey(decision.canonicalTutorName)}::${normalizeNameKey(decision.petLabel)}`;
    if (key !== "::") pets.set(key, cleanDisplayName(decision.canonicalPetName || decision.petLabel));
  }
  return pets;
}

function optionalText(value: unknown) {
  const text = compact(value);
  return text || undefined;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function comparableAddress(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/\bcep\s*:?\s*\d{5}-?\d{3}\b/g, "")
    .replace(/\bn[°.º]?\s*/g, "numero ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameFieldValue(field: keyof Omit<TutorDraft, "name" | "origins">, current: string, incoming: string) {
  if (field === "phone" || field === "document" || field === "cep") {
    return digitsOnly(current) === digitsOnly(incoming);
  }
  if (field === "email") {
    return current.toLowerCase() === incoming.toLowerCase();
  }
  if (field === "address") {
    const a = comparableAddress(current);
    const b = comparableAddress(incoming);
    return a === b || a.includes(b) || b.includes(a);
  }
  return normalizeNameKey(current) === normalizeNameKey(incoming);
}

function normalizedPayload(record: ImportRecordDraft) {
  return (record.normalizedPayload ?? {}) as Record<string, unknown>;
}

function mergeTutor(
  tutors: Map<string, TutorDraft>,
  conflicts: ConflictDraft[],
  tutor: TutorDraft,
) {
  const key = normalizeNameKey(tutor.name);
  if (!key) return;
  const existing = tutors.get(key);
  if (!existing) {
    tutors.set(key, tutor);
    return;
  }

  for (const field of ["phone", "email", "document", "birthDate", "address", "cep"] as const) {
    const current = existing[field];
    const incoming = tutor[field];
    if (!current && incoming) {
      existing[field] = incoming;
      continue;
    }
    if (current && incoming && !sameFieldValue(field, current, incoming)) {
      conflicts.push({
        type: "FIELD_MISMATCH",
        title: `Dado divergente para tutor ${existing.name}`,
        description: `${field}: "${current}" <> "${incoming}"`,
        origins: [...existing.origins, ...tutor.origins],
      });
    }
  }
  existing.origins.push(...tutor.origins);
}

async function readDecisions(): Promise<DecisionsPayload> {
  try {
    return JSON.parse(await fs.readFile(DECISIONS_JSON, "utf8")) as DecisionsPayload;
  } catch (error) {
    throw new Error(`Run npm.cmd run import:decisions before dry-run. Missing ${DECISIONS_JSON}. ${String(error)}`);
  }
}

async function main() {
  const decisions = await readDecisions();
  const tutorAliasMap = buildTutorAliasMap(decisions.tutorMergeGroups);
  const petNameMap = buildPetNameMap(decisions.petDecisions);
  const batches = await parseProjectDiagnostics(process.cwd());

  const tutors = new Map<string, TutorDraft>();
  const pets = new Map<string, PetDraft>();
  const reservations: unknown[] = [];
  const financialEntries: unknown[] = [];
  const financialSummaries: unknown[] = [];
  const servicePrices: unknown[] = [];
  const taxiRules: unknown[] = [];
  const conflicts: ConflictDraft[] = [];

  function canonicalTutorName(value: unknown) {
    const cleaned = cleanDisplayName(value);
    return tutorAliasMap.get(normalizeNameKey(cleaned)) ?? cleaned;
  }

  function canonicalPetName(tutorName: string, petName: string) {
    const key = `${normalizeNameKey(tutorName)}::${normalizeNameKey(petName)}`;
    return petNameMap.get(key) ?? cleanDisplayName(petName);
  }

  function addPet(tutorName: string, petName: string, origin: Origin) {
    const name = canonicalPetName(tutorName, petName);
    if (!name) return;
    const key = `${normalizeNameKey(tutorName)}::${normalizeNameKey(name)}`;
    const existing = pets.get(key);
    if (existing) {
      existing.origins.push(origin);
      return;
    }
    pets.set(key, { name, tutorName, origins: [origin] });
  }

  for (const batch of batches) {
    for (const record of batch.records) {
      const payload = normalizedPayload(record);
      const origin = sourceOf(batch, record);
      if (record.status === "NEEDS_REVIEW") {
        conflicts.push({
          type: "DIVERGENT_SOURCE",
          title: "Registro precisa de revisao antes da importacao",
          origins: [origin],
          payload,
        });
      }

      if (record.detectedType === "CLIENT_FORM") {
        const tutorName = canonicalTutorName(payload.tutorName);
        if (!tutorName) continue;
        mergeTutor(tutors, conflicts, {
          name: tutorName,
          phone: normalizePhone(payload.phone),
          email: optionalText(payload.email),
          document: optionalText(payload.document),
          birthDate: optionalText(payload.birthDate),
          address: optionalText(payload.address),
          cep: optionalText(payload.cep),
          origins: [origin],
        });
        for (const petName of asStringArray(payload.pets)) addPet(tutorName, petName, origin);
        continue;
      }

      if (record.detectedType === "HISTORICAL_RESERVATION") {
        const tutorName = canonicalTutorName(payload.tutorName);
        if (tutorName) {
          mergeTutor(tutors, conflicts, { name: tutorName, origins: [origin] });
          for (const petName of asStringArray(payload.pets)) addPet(tutorName, petName, origin);
        }
        reservations.push({
          tutorName,
          petNames: asStringArray(payload.pets).map((petName) => canonicalPetName(tutorName, petName)),
          service: optionalText(payload.service),
          period: optionalText(payload.period),
          amountCents: payload.amountCents ?? null,
          payment: optionalText(payload.payment),
          source: origin,
        });
        continue;
      }

      if (record.detectedType === "DAYCARE_RESERVATION") {
        const tutorName = canonicalTutorName(payload.tutorName);
        if (tutorName) {
          mergeTutor(tutors, conflicts, { name: tutorName, origins: [origin] });
          for (const petName of asStringArray(payload.petName)) addPet(tutorName, petName, origin);
        }
        reservations.push({
          tutorName,
          petNames: asStringArray(payload.petName).map((petName) => canonicalPetName(tutorName, petName)),
          service: "Creche",
          date: optionalText(payload.date),
          schedule: optionalText(payload.schedule),
          amountCents: payload.amountCents ?? null,
          payment: optionalText(payload.payment),
          source: origin,
        });
        continue;
      }

      if (record.detectedType === "FINANCIAL_ENTRY") {
        financialEntries.push({ ...payload, source: origin });
        continue;
      }

      if (record.detectedType === "FINANCIAL_SUMMARY") {
        financialSummaries.push({ ...payload, source: origin });
        continue;
      }

      if (record.detectedType === "SERVICE_PRICE") {
        servicePrices.push({ ...payload, source: origin });
        continue;
      }

      if (record.detectedType === "TAXI_RULE") {
        taxiRules.push({ ...payload, source: origin });
      }
    }
  }

  for (const candidate of decisions.similarTutorCandidates.filter((item) => item.status === "review-only")) {
    conflicts.push({
      type: "DUPLICATE_TUTOR",
      title: `Possivel tutor duplicado: ${candidate.nameA} <> ${candidate.nameB}`,
      description: `Similaridade ${candidate.score}. Nao sera mesclado automaticamente sem validacao.`,
      payload: candidate,
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    decisionsFile: DECISIONS_JSON,
    totals: {
      sourceFiles: batches.length,
      sourceRecords: batches.reduce((sum, batch) => sum + batch.records.length, 0),
      tutors: tutors.size,
      pets: pets.size,
      reservations: reservations.length,
      financialEntries: financialEntries.length,
      financialSummaries: financialSummaries.length,
      servicePrices: servicePrices.length,
      taxiRules: taxiRules.length,
      conflicts: conflicts.length,
    },
    tutors: [...tutors.values()],
    pets: [...pets.values()],
    reservations,
    financialEntries,
    financialSummaries,
    servicePrices,
    taxiRules,
    conflicts,
  };

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(DRY_RUN_JSON, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  await fs.writeFile(DRY_RUN_SUMMARY, markdownSummary(output), "utf8");

  console.log(`Dry-run JSON: ${DRY_RUN_JSON}`);
  console.log(`Resumo: ${DRY_RUN_SUMMARY}`);
  console.log(`Conflitos restantes: ${conflicts.length}`);
}

function markdownSummary(output: {
  generatedAt: string;
  totals: Record<string, number>;
  conflicts: ConflictDraft[];
}) {
  const lines = [
    "# Dry-run oficial de importacao",
    "",
    `Gerado em: ${output.generatedAt}`,
    "",
    "## Totais",
    "",
    ...Object.entries(output.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Conflitos restantes",
    "",
    ...(output.conflicts.length
      ? output.conflicts.slice(0, 40).map((conflict) => `- ${conflict.type}: ${conflict.title}`)
      : ["- Nenhum conflito restante no dry-run."]),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
