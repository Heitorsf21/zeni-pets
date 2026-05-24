import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/db";

type Db = PrismaClient | Prisma.TransactionClient;
type DedupeType = "TUTOR" | "PET";

type CandidateInput = {
  type: DedupeType;
  groupKey: string;
  confidence: number;
  candidateIds: string[];
  summary: Prisma.InputJsonValue;
};

export type TutorForDedupe = Awaited<ReturnType<typeof loadTutorsForDedupe>>[number];
type PetForDedupe = Awaited<ReturnType<typeof loadPetsForDedupe>>[number];

export type DedupeSummaryItem = {
  id: string;
  name: string;
  subtitle?: string;
  evidence: string[];
};

export type DedupeCandidateView = {
  id: string;
  type: DedupeType;
  groupKey: string;
  confidence: number;
  candidateIds: string[];
  summary: {
    title: string;
    reason: string;
    items: DedupeSummaryItem[];
  };
};

export function normalizeDedupeName(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bcadastrad[ao]s?\b/gi, " ")
    .replace(/\bcadastro\b/gi, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.replace(/^55/, "");
}

export function normalizedTutorPhones(input: {
  phone?: string | null;
  secondaryPhone?: string | null;
}) {
  return withoutDuplicates(
    [input.phone, input.secondaryPhone]
      .map((phone) => normalizePhone(phone))
      .filter((phone) => phone.length >= 8),
  );
}

export function firstNameKey(value: string | null | undefined) {
  return normalizeDedupeName(value).split(" ")[0] ?? "";
}

function groupBy<T>(items: T[], keyFn: (item: T) => string) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

function idSetKey(ids: string[]) {
  return [...ids].sort().join("|");
}

function withoutDuplicates<T>(values: T[]) {
  return [...new Set(values)];
}

function loadTutorsForDedupe(db: Db) {
  return db.tutor.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      secondaryPhone: true,
      secondaryPhoneNote: true,
      document: true,
      birthDate: true,
      address: true,
      cep: true,
      notes: true,
      sourcePayload: true,
      mergedFromIds: true,
      mergedSourcePayloads: true,
      createdAt: true,
      _count: { select: { pets: true, reservations: true, tasks: true } },
    },
    orderBy: { name: "asc" },
  });
}

function loadPetsForDedupe(db: Db) {
  return db.pet.findMany({
    select: {
      id: true,
      tutorId: true,
      name: true,
      species: true,
      breed: true,
      ageLabel: true,
      birthDate: true,
      weightKg: true,
      isNeutered: true,
      isSociable: true,
      foodNotes: true,
      healthNotes: true,
      behaviorNotes: true,
      vetName: true,
      vetPhone: true,
      deliveredItems: true,
      sourcePayload: true,
      mergedFromIds: true,
      mergedSourcePayloads: true,
      createdAt: true,
      tutor: { select: { name: true, phone: true, email: true } },
      _count: { select: { reservationPets: true, tasks: true } },
    },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });
}

function tutorCandidateSummary(group: TutorForDedupe[], reason: string) {
  return {
    title: group.map((item) => item.name).join(" / "),
    reason,
    items: group.map((tutor) => ({
      id: tutor.id,
      name: tutor.name,
      subtitle: tutor.phone || tutor.secondaryPhone || tutor.email || "Sem contato",
      evidence: [
        `${tutor._count.pets} pets`,
        `${tutor._count.reservations} reservas`,
        tutor.email ? `email: ${tutor.email}` : "sem email",
        tutor.phone ? `tel: ${tutor.phone}` : "sem telefone",
        tutor.secondaryPhone ? `tel 2: ${tutor.secondaryPhone}` : "sem segundo telefone",
      ],
    })),
  } satisfies DedupeCandidateView["summary"];
}

function petCandidateSummary(group: PetForDedupe[], reason: string) {
  return {
    title: group.map((item) => `${item.name} (${item.tutor.name})`).join(" / "),
    reason,
    items: group.map((pet) => ({
      id: pet.id,
      name: pet.name,
      subtitle: `Tutor: ${pet.tutor.name}`,
      evidence: [
        pet.breed ? `raça: ${pet.breed}` : "sem raça",
        `${pet._count.reservationPets} reservas`,
        `${pet._count.tasks} tarefas`,
      ],
    })),
  } satisfies DedupeCandidateView["summary"];
}

export function tutorCanonicalSort(a: TutorForDedupe, b: TutorForDedupe) {
  const score = (item: TutorForDedupe) =>
    item._count.reservations * 100 +
    item._count.pets * 20 +
    item._count.tasks * 10 +
    (item.phone || item.secondaryPhone ? 5 : 0) +
    (item.email ? 5 : 0) +
    (/\(/.test(item.name) ? -3 : 0);
  return score(b) - score(a) || a.createdAt.getTime() - b.createdAt.getTime();
}

function petCanonicalSort(a: PetForDedupe, b: PetForDedupe) {
  const score = (item: PetForDedupe) =>
    item._count.reservationPets * 100 +
    item._count.tasks * 10 +
    (item.breed ? 5 : 0) +
    (/\(/.test(item.name) ? -3 : 0);
  return score(b) - score(a) || a.createdAt.getTime() - b.createdAt.getTime();
}

export async function buildTutorDedupeCandidates(db: Db): Promise<CandidateInput[]> {
  const tutors = await loadTutorsForDedupe(db);
  const seen = new Set<string>();
  const candidates: CandidateInput[] = [];

  for (const [key, group] of groupBy(tutors, (tutor) => normalizeDedupeName(tutor.name))) {
    const ids = group.map((item) => item.id);
    const setKey = idSetKey(ids);
    seen.add(setKey);
    candidates.push({
      type: "TUTOR",
      groupKey: `tutor-name:${key}`,
      confidence: 0.95,
      candidateIds: ids,
      summary: tutorCandidateSummary([...group].sort(tutorCanonicalSort), "Mesmo nome após normalização."),
    });
  }

  const tutorPhoneEntries = tutors.flatMap((tutor) =>
    normalizedTutorPhones(tutor).map((phone) => ({ tutor, phone })),
  );
  for (const [key, group] of groupBy(
    tutorPhoneEntries,
    (entry) => `${firstNameKey(entry.tutor.name)}|${entry.phone}`,
  )) {
    const tutorsInGroup = withoutDuplicates(group.map((entry) => entry.tutor));
    if (tutorsInGroup.length < 2) continue;
    const ids = tutorsInGroup.map((item) => item.id);
    const setKey = idSetKey(ids);
    if (seen.has(setKey)) continue;
    seen.add(setKey);
    candidates.push({
      type: "TUTOR",
      groupKey: `tutor-phone:${key}`,
      confidence: 0.9,
      candidateIds: ids,
      summary: tutorCandidateSummary([...tutorsInGroup].sort(tutorCanonicalSort), "Primeiro nome e telefone coincidem."),
    });
  }

  return candidates;
}

export async function buildPetDedupeCandidates(db: Db): Promise<CandidateInput[]> {
  const pets = await loadPetsForDedupe(db);
  return groupBy(pets, (pet) => `${normalizeDedupeName(pet.name)}|${firstNameKey(pet.tutor.name)}`)
    .map(([key, group]) => {
      const breeds = withoutDuplicates(group.map((pet) => normalizeDedupeName(pet.breed)).filter(Boolean));
      const sorted = [...group].sort(petCanonicalSort);
      return {
        type: "PET" as const,
        groupKey: `pet-name-tutor:${key}`,
        confidence: breeds.length <= 1 ? 0.9 : 0.72,
        candidateIds: sorted.map((item) => item.id),
        summary: petCandidateSummary(
          sorted,
          breeds.length <= 1
            ? "Mesmo nome do pet e primeiro nome do tutor; raça compatível."
            : "Mesmo nome do pet e primeiro nome do tutor; revisar raça antes de mesclar.",
        ),
      };
    });
}

export async function replaceOpenDedupeCandidates(type: DedupeType, candidates: CandidateInput[]) {
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.dedupeCandidate.deleteMany({ where: { type, status: "OPEN" } }),
    ...candidates.map((candidate) =>
      prisma.dedupeCandidate.create({
        data: {
          type: candidate.type,
          groupKey: candidate.groupKey,
          confidence: candidate.confidence,
          candidateIds: candidate.candidateIds,
          summary: candidate.summary,
        },
      }),
    ),
  ]);
  return candidates.length;
}

function parseCandidateSummary(value: Prisma.JsonValue): DedupeCandidateView["summary"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { title: "Candidato sem resumo", reason: "Sem detalhes", items: [] };
  }
  const summary = value as Record<string, unknown>;
  const items = Array.isArray(summary.items)
    ? summary.items
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
        .map((item) => ({
          id: String(item.id ?? ""),
          name: String(item.name ?? "Sem nome"),
          subtitle: item.subtitle ? String(item.subtitle) : undefined,
          evidence: Array.isArray(item.evidence) ? item.evidence.map(String) : [],
        }))
    : [];
  return {
    title: String(summary.title ?? "Candidato"),
    reason: String(summary.reason ?? "Possivel duplicidade"),
    items,
  };
}

export async function getDedupeReviewData() {
  const prisma = getPrisma();
  const [candidates, auditLogs] = await Promise.all([
    prisma.dedupeCandidate.findMany({
      where: { status: "OPEN" },
      orderBy: [{ type: "asc" }, { confidence: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
    prisma.dedupeAuditLog.findMany({
      orderBy: { performedAt: "desc" },
      take: 8,
    }),
  ]);

  const mapped = candidates.map((candidate) => ({
    id: candidate.id,
    type: candidate.type as DedupeType,
    groupKey: candidate.groupKey,
    confidence: candidate.confidence,
    candidateIds: candidate.candidateIds,
    summary: parseCandidateSummary(candidate.summary),
  }));

  return {
    tutorCandidates: mapped.filter((candidate) => candidate.type === "TUTOR"),
    petCandidates: mapped.filter((candidate) => candidate.type === "PET"),
    auditLogs,
  };
}

function payloadItemsFromEntities(items: Array<{ id: string; name: string; sourcePayload: Prisma.JsonValue | null }>) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    sourcePayload: item.sourcePayload,
  }));
}

function mergePayloads(current: Prisma.JsonValue | null, additions: Prisma.InputJsonValue[]) {
  const currentItems = Array.isArray(current) ? current : current ? [current] : [];
  return [...currentItems, ...additions] as Prisma.InputJsonValue;
}

function mergeNotes(canonicalNote: string | null, duplicateNotes: Array<{ name: string; notes: string | null }>) {
  const notes = [canonicalNote?.trim()].filter(Boolean) as string[];
  for (const duplicate of duplicateNotes) {
    const note = duplicate.notes?.trim();
    if (note) notes.push(`--- merged from ${duplicate.name} ---\n${note}`);
  }
  return notes.length ? notes.join("\n") : null;
}

function firstValue<T>(current: T | null | undefined, alternatives: Array<T | null | undefined>) {
  return current ?? alternatives.find((value) => value != null) ?? null;
}

export type TutorMergeField =
  | "email"
  | "phone"
  | "secondaryPhone"
  | "secondaryPhoneNote"
  | "document"
  | "birthDate"
  | "address"
  | "cep"
  | "notes";

export type TutorMergeOverrides = Partial<Record<TutorMergeField, string>>;

function pickOverride<T>(
  field: TutorMergeField,
  overrides: TutorMergeOverrides | undefined,
  fromId: (id: string) => T | null | undefined,
  fallback: T | null,
): T | null {
  const sourceId = overrides?.[field];
  if (!sourceId) return fallback;
  const value = fromId(sourceId);
  return (value ?? null) as T | null;
}

export async function mergeTutors(input: {
  candidateId?: string | null;
  canonicalId: string;
  mergeIds: string[];
  performedBy?: string | null;
  fieldOverrides?: TutorMergeOverrides;
  origin?: string;
}) {
  const mergeIds = withoutDuplicates(input.mergeIds.filter((id) => id && id !== input.canonicalId));
  if (!input.canonicalId || !mergeIds.length) {
    throw new Error("Escolha o tutor canonico e pelo menos um tutor para mesclar.");
  }

  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const tutors = await tx.tutor.findMany({
      where: { id: { in: [input.canonicalId, ...mergeIds] } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        secondaryPhone: true,
        secondaryPhoneNote: true,
        document: true,
        birthDate: true,
        address: true,
        cep: true,
        notes: true,
        sourcePayload: true,
        mergedFromIds: true,
        mergedSourcePayloads: true,
      },
    });
    const canonical = tutors.find((tutor) => tutor.id === input.canonicalId);
    const duplicates = tutors.filter((tutor) => mergeIds.includes(tutor.id));
    if (!canonical || duplicates.length !== mergeIds.length) {
      throw new Error("Tutor canônico ou duplicados não encontrados.");
    }

    await tx.pet.updateMany({ where: { tutorId: { in: mergeIds } }, data: { tutorId: input.canonicalId } });
    await tx.reservation.updateMany({ where: { tutorId: { in: mergeIds } }, data: { tutorId: input.canonicalId } });
    await tx.task.updateMany({ where: { tutorId: { in: mergeIds } }, data: { tutorId: input.canonicalId } });

    const mergedFromIds = withoutDuplicates([
      ...canonical.mergedFromIds,
      ...duplicates.flatMap((tutor) => [tutor.id, ...tutor.mergedFromIds]),
    ]);
    const sourcePayloads = payloadItemsFromEntities([canonical, ...duplicates]);

    const canonicalTutor = canonical;
    type TutorRecord = typeof canonicalTutor;
    const byId = new Map<string, TutorRecord>(tutors.map((tutor) => [tutor.id, tutor]));
    const overrides = input.fieldOverrides;
    const pick = <K extends TutorMergeField, V>(field: K, getter: (tutor: TutorRecord) => V | null | undefined, fallback: V | null) =>
      pickOverride<V>(field, overrides, (id) => getter(byId.get(id) ?? canonicalTutor), fallback);

    await tx.tutor.update({
      where: { id: input.canonicalId },
      data: {
        email: pick("email", (tutor) => tutor.email, firstValue(canonical.email, duplicates.map((tutor) => tutor.email))),
        phone: pick("phone", (tutor) => tutor.phone, firstValue(canonical.phone, duplicates.map((tutor) => tutor.phone))),
        secondaryPhone: pick(
          "secondaryPhone",
          (tutor) => tutor.secondaryPhone,
          firstValue(canonical.secondaryPhone, duplicates.map((tutor) => tutor.secondaryPhone)),
        ),
        secondaryPhoneNote: pick(
          "secondaryPhoneNote",
          (tutor) => tutor.secondaryPhoneNote,
          firstValue(canonical.secondaryPhoneNote, duplicates.map((tutor) => tutor.secondaryPhoneNote)),
        ),
        document: pick("document", (tutor) => tutor.document, firstValue(canonical.document, duplicates.map((tutor) => tutor.document))),
        birthDate: pick("birthDate", (tutor) => tutor.birthDate, firstValue(canonical.birthDate, duplicates.map((tutor) => tutor.birthDate))),
        address: pick("address", (tutor) => tutor.address, firstValue(canonical.address, duplicates.map((tutor) => tutor.address))),
        cep: pick("cep", (tutor) => tutor.cep, firstValue(canonical.cep, duplicates.map((tutor) => tutor.cep))),
        notes: overrides?.notes
          ? byId.get(overrides.notes)?.notes ?? null
          : mergeNotes(canonical.notes, duplicates),
        mergedFromIds: { set: mergedFromIds },
        mergedSourcePayloads: mergePayloads(canonical.mergedSourcePayloads, sourcePayloads),
      },
    });

    await tx.tutor.deleteMany({ where: { id: { in: mergeIds } } });
    await tx.dedupeCandidate.updateMany({
      where: { type: "TUTOR", status: "OPEN", candidateIds: { hasSome: mergeIds } },
      data: { status: "STALE" },
    });
    if (input.candidateId) {
      await tx.dedupeCandidate.update({
        where: { id: input.candidateId },
        data: { status: "MERGED", canonicalId: input.canonicalId },
      });
    }
    await tx.dedupeAuditLog.create({
      data: {
        type: "TUTOR",
        canonicalId: input.canonicalId,
        mergedIds: mergeIds,
        performedBy: input.performedBy,
        summary: {
          canonical: { id: canonical.id, name: canonical.name },
          merged: duplicates.map((tutor) => ({ id: tutor.id, name: tutor.name })),
          origin: input.origin ?? (input.candidateId ? "candidate" : "manual"),
          overrides: overrides ?? null,
        },
      },
    });

    return { canonicalId: input.canonicalId, mergedIds: mergeIds };
  });
}

function mergePetTextField(current: string | null, duplicates: Array<{ name: string; value: string | null }>) {
  const values = [current?.trim()].filter(Boolean) as string[];
  for (const duplicate of duplicates) {
    const value = duplicate.value?.trim();
    if (value && !values.includes(value)) values.push(`--- merged from ${duplicate.name} ---\n${value}`);
  }
  return values.length ? values.join("\n") : null;
}

export async function mergePets(input: {
  candidateId?: string | null;
  canonicalId: string;
  mergeIds: string[];
  performedBy?: string | null;
}) {
  const mergeIds = withoutDuplicates(input.mergeIds.filter((id) => id && id !== input.canonicalId));
  if (!input.canonicalId || !mergeIds.length) {
    throw new Error("Escolha o pet canonico e pelo menos um pet para mesclar.");
  }

  const prisma = getPrisma();
  return prisma.$transaction(async (tx) => {
    const pets = await tx.pet.findMany({
      where: { id: { in: [input.canonicalId, ...mergeIds] } },
      select: {
        id: true,
        name: true,
        species: true,
        breed: true,
        ageLabel: true,
        birthDate: true,
        weightKg: true,
        isNeutered: true,
        isSociable: true,
        foodNotes: true,
        healthNotes: true,
        behaviorNotes: true,
        vetName: true,
        vetPhone: true,
        deliveredItems: true,
        sourcePayload: true,
        mergedFromIds: true,
        mergedSourcePayloads: true,
      },
    });
    const canonical = pets.find((pet) => pet.id === input.canonicalId);
    const duplicates = pets.filter((pet) => mergeIds.includes(pet.id));
    if (!canonical || duplicates.length !== mergeIds.length) {
      throw new Error("Pet canônico ou duplicados não encontrados.");
    }

    for (const duplicateId of mergeIds) {
      const links = await tx.reservationPet.findMany({
        where: { petId: duplicateId },
        select: { id: true, reservationId: true },
      });
      for (const link of links) {
        const canonicalLink = await tx.reservationPet.findUnique({
          where: {
            reservationId_petId: {
              reservationId: link.reservationId,
              petId: input.canonicalId,
            },
          },
          select: { id: true },
        });
        if (canonicalLink) {
          await tx.reservationPet.delete({ where: { id: link.id } });
        } else {
          await tx.reservationPet.update({ where: { id: link.id }, data: { petId: input.canonicalId } });
        }
      }
    }
    await tx.task.updateMany({ where: { petId: { in: mergeIds } }, data: { petId: input.canonicalId } });

    const mergedFromIds = withoutDuplicates([
      ...canonical.mergedFromIds,
      ...duplicates.flatMap((pet) => [pet.id, ...pet.mergedFromIds]),
    ]);
    const sourcePayloads = payloadItemsFromEntities([canonical, ...duplicates]);

    await tx.pet.update({
      where: { id: input.canonicalId },
      data: {
        breed: firstValue(canonical.breed, duplicates.map((pet) => pet.breed)),
        ageLabel: firstValue(canonical.ageLabel, duplicates.map((pet) => pet.ageLabel)),
        birthDate: firstValue(canonical.birthDate, duplicates.map((pet) => pet.birthDate)),
        weightKg: firstValue(canonical.weightKg, duplicates.map((pet) => pet.weightKg)),
        isNeutered: firstValue(canonical.isNeutered, duplicates.map((pet) => pet.isNeutered)),
        isSociable: firstValue(canonical.isSociable, duplicates.map((pet) => pet.isSociable)),
        foodNotes: mergePetTextField(canonical.foodNotes, duplicates.map((pet) => ({ name: pet.name, value: pet.foodNotes }))),
        healthNotes: mergePetTextField(canonical.healthNotes, duplicates.map((pet) => ({ name: pet.name, value: pet.healthNotes }))),
        behaviorNotes: mergePetTextField(canonical.behaviorNotes, duplicates.map((pet) => ({ name: pet.name, value: pet.behaviorNotes }))),
        vetName: firstValue(canonical.vetName, duplicates.map((pet) => pet.vetName)),
        vetPhone: firstValue(canonical.vetPhone, duplicates.map((pet) => pet.vetPhone)),
        deliveredItems: mergePetTextField(canonical.deliveredItems, duplicates.map((pet) => ({ name: pet.name, value: pet.deliveredItems }))),
        mergedFromIds: { set: mergedFromIds },
        mergedSourcePayloads: mergePayloads(canonical.mergedSourcePayloads, sourcePayloads),
      },
    });

    await tx.pet.deleteMany({ where: { id: { in: mergeIds } } });
    await tx.dedupeCandidate.updateMany({
      where: { type: "PET", status: "OPEN", candidateIds: { hasSome: mergeIds } },
      data: { status: "STALE" },
    });
    if (input.candidateId) {
      await tx.dedupeCandidate.update({
        where: { id: input.candidateId },
        data: { status: "MERGED", canonicalId: input.canonicalId },
      });
    }
    await tx.dedupeAuditLog.create({
      data: {
        type: "PET",
        canonicalId: input.canonicalId,
        mergedIds: mergeIds,
        performedBy: input.performedBy,
        summary: {
          canonical: { id: canonical.id, name: canonical.name },
          merged: duplicates.map((pet) => ({ id: pet.id, name: pet.name })),
        },
      },
    });

    return { canonicalId: input.canonicalId, mergedIds: mergeIds };
  });
}
