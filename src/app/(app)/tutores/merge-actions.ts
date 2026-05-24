"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import {
  mergeTutors,
  tutorCanonicalSort,
  type TutorMergeField,
  type TutorMergeOverrides,
} from "@/lib/dedupe";

const MERGE_FIELDS: readonly TutorMergeField[] = [
  "email",
  "phone",
  "secondaryPhone",
  "secondaryPhoneNote",
  "document",
  "birthDate",
  "address",
  "cep",
  "notes",
] as const;

export type TutorMergePreviewItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  secondaryPhone: string | null;
  secondaryPhoneNote: string | null;
  document: string | null;
  birthDate: string | null;
  address: string | null;
  cep: string | null;
  notes: string | null;
  petsCount: number;
  reservationsCount: number;
  tasksCount: number;
  createdAt: string;
};

export type TutorMergeFieldDiff = {
  field: TutorMergeField;
  values: Array<{ tutorId: string; value: string | null }>;
  divergent: boolean;
  suggestedTutorId: string | null;
};

export type TutorMergePreview = {
  ok: true;
  suggestedCanonicalId: string;
  tutors: TutorMergePreviewItem[];
  fields: TutorMergeFieldDiff[];
  warnings: string[];
} | {
  ok: false;
  error: string;
};

function fieldValue(tutor: TutorMergePreviewItem, field: TutorMergeField): string | null {
  return tutor[field] ?? null;
}

export async function previewMergeTutorsAction(ids: string[]): Promise<TutorMergePreview> {
  await requireUser();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length < 2) {
    return { ok: false, error: "Selecione pelo menos 2 tutores para mesclar." };
  }
  if (unique.length > 5) {
    return { ok: false, error: "Mesclagem manual aceita ate 5 tutores por vez." };
  }

  const tutors = await getPrisma().tutor.findMany({
    where: { id: { in: unique } },
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
  });

  if (tutors.length !== unique.length) {
    return { ok: false, error: "Um ou mais tutores selecionados não foram encontrados." };
  }

  const sorted = [...tutors].sort(tutorCanonicalSort);
  const suggested = sorted[0];

  const items: TutorMergePreviewItem[] = sorted.map((tutor) => ({
    id: tutor.id,
    name: tutor.name,
    email: tutor.email,
    phone: tutor.phone,
    secondaryPhone: tutor.secondaryPhone,
    secondaryPhoneNote: tutor.secondaryPhoneNote,
    document: tutor.document,
    birthDate: tutor.birthDate ? tutor.birthDate.toISOString() : null,
    address: tutor.address,
    cep: tutor.cep,
    notes: tutor.notes,
    petsCount: tutor._count.pets,
    reservationsCount: tutor._count.reservations,
    tasksCount: tutor._count.tasks,
    createdAt: tutor.createdAt.toISOString(),
  }));

  const fields: TutorMergeFieldDiff[] = MERGE_FIELDS.map((field) => {
    const values = items.map((tutor) => ({ tutorId: tutor.id, value: fieldValue(tutor, field) }));
    const distinctNonEmpty = new Set(values.map((v) => v.value).filter((v): v is string => Boolean(v && v.trim())));
    const divergent = distinctNonEmpty.size > 1;
    const suggestedTutorId = values.find((v) => v.tutorId === suggested.id && v.value)?.tutorId
      ?? values.find((v) => v.value)?.tutorId
      ?? null;
    return { field, values, divergent, suggestedTutorId };
  });

  const warnings: string[] = [];
  const documents = new Set(items.map((tutor) => tutor.document?.trim()).filter((d): d is string => Boolean(d)));
  if (documents.size > 1) {
    warnings.push("Os tutores selecionados tem documentos (CPF/RG) diferentes. Verifique antes de mesclar.");
  }
  const phones = new Set(
    items
      .flatMap((tutor) => [tutor.phone, tutor.secondaryPhone])
      .map((phone) => phone?.replace(/\D/g, ""))
      .filter((p): p is string => Boolean(p && p.length >= 8)),
  );
  if (phones.size > 1) {
    warnings.push("Os telefones cadastrados sao diferentes. Confirme qual e o correto.");
  }

  return { ok: true, suggestedCanonicalId: suggested.id, tutors: items, fields, warnings };
}

function parseFieldOverrides(formData: FormData, tutorIds: Set<string>): TutorMergeOverrides {
  const overrides: TutorMergeOverrides = {};
  for (const field of MERGE_FIELDS) {
    const raw = formData.get(`override_${field}`);
    if (typeof raw !== "string" || !raw) continue;
    if (raw === "auto") continue;
    if (!tutorIds.has(raw)) continue;
    overrides[field] = raw;
  }
  return overrides;
}

export async function mergeTutoresManualmenteAction(formData: FormData) {
  const userId = await requireUser();
  const canonicalId = String(formData.get("canonicalId") ?? "");
  const mergeIds = formData.getAll("mergeIds").map(String).filter(Boolean);

  if (!canonicalId || mergeIds.length === 0) {
    redirect(`/tutores?error=${encodeURIComponent("Escolha o tutor canonico e pelo menos um duplicado.")}`);
  }

  const allIds = new Set<string>([canonicalId, ...mergeIds]);
  if (allIds.size < 2) {
    redirect(`/tutores?error=${encodeURIComponent("Selecione tutores diferentes para mesclar.")}`);
  }
  if (allIds.size > 5) {
    redirect(`/tutores?error=${encodeURIComponent("Mesclagem manual aceita ate 5 tutores por vez.")}`);
  }

  const fieldOverrides = parseFieldOverrides(formData, allIds);

  try {
    await mergeTutors({
      candidateId: null,
      canonicalId,
      mergeIds,
      performedBy: userId,
      fieldOverrides,
      origin: "manual-tutores-page",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao mesclar tutores";
    redirect(`/tutores?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/tutores");
  revalidatePath("/pets");
  revalidatePath("/reservas");
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  revalidatePath("/financeiro");
  revalidatePath("/importacao");
  redirect(`/tutores?merged=${mergeIds.length}`);
}
