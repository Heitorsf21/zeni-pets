"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import {
  buildPetDedupeCandidates,
  buildTutorDedupeCandidates,
  mergePets,
  mergeTutors,
  replaceOpenDedupeCandidates,
} from "@/lib/dedupe";
import { optionalStringField } from "@/lib/forms";
import { APPLIERS } from "@/lib/import/applier";

type ReviewRecordStatus = "APPROVED" | "REJECTED" | "NEEDS_REVIEW" | "PENDING_REVIEW";
type ReviewResolutionAction = "APPROVE" | "REJECT" | "MERGE_TUTOR" | "MERGE_PET" | "CORRECT_FIELD" | "IGNORE";
type ImportAttemptResult =
  | { ok: true; targetModel: string; targetId: string; alreadyImported?: boolean; financeMonth?: string | null }
  | { ok: false; reason: string };

function redirectWithError(message: string): never {
  redirect(`/importacao?error=${encodeURIComponent(message)}`);
}

function stringValues(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

function parseJsonField(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    redirectWithError("JSON normalizado inválido");
  }
}

function isPayloadObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function financeMonthFromPayload(detectedType: string, payload: Record<string, unknown>) {
  if (detectedType !== "FINANCIAL_ENTRY") return null;
  const date = new Date(String(payload.date ?? ""));
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function revalidateImportTargets() {
  revalidatePath("/importacao");
  revalidatePath("/dashboard");
  revalidatePath("/tutores");
  revalidatePath("/pets");
  revalidatePath("/reservas");
  revalidatePath("/financeiro");
  revalidatePath("/valores");
}

async function importRecordTransaction(id: string): Promise<ImportAttemptResult> {
  return getPrisma().$transaction(async (tx) => {
    const record = await tx.importRecord.findUnique({ where: { id } });
    if (!record) return { ok: false, reason: "registro-nao-encontrado" };

    if (record.status === "IMPORTED") {
      const importedResolution = await tx.importResolution.findFirst({
        where: { sourceRecordId: id, action: "IMPORT_RECORD" },
        orderBy: { createdAt: "desc" },
        select: { targetModel: true, targetId: true },
      });
      return {
        ok: true,
        alreadyImported: true,
        targetModel: importedResolution?.targetModel ?? "ImportRecord",
        targetId: importedResolution?.targetId ?? id,
      };
    }

    if (!isPayloadObject(record.normalizedPayload)) {
      const reason = record.normalizedPayload ? "payload-invalido" : "sem-payload";
      await tx.importRecord.update({
        where: { id },
        data: {
          status: "NEEDS_REVIEW",
          reviewNotes: `Falha ao importar: ${reason}`,
        },
      });
      await tx.importResolution.create({
        data: {
          batchId: record.batchId,
          sourceRecordId: id,
          action: "IMPORT_RECORD",
          notes: `Falha ao importar: ${reason}`,
        },
      });
      return { ok: false, reason };
    }

    const applier = APPLIERS[record.detectedType as keyof typeof APPLIERS];
    if (!applier) {
      const reason = "tipo-nao-suportado";
      await tx.importRecord.update({
        where: { id },
        data: {
          status: "NEEDS_REVIEW",
          reviewNotes: `Falha ao importar: ${reason}`,
        },
      });
      await tx.importResolution.create({
        data: {
          batchId: record.batchId,
          sourceRecordId: id,
          action: "IMPORT_RECORD",
          notes: `Falha ao importar: ${reason}`,
        },
      });
      return { ok: false, reason };
    }

    const result = await applier(tx, id, record.normalizedPayload);
    if (!result.ok) {
      await tx.importRecord.update({
        where: { id },
        data: {
          status: "NEEDS_REVIEW",
          reviewNotes: `Falha ao importar: ${result.reason}`,
        },
      });
      await tx.importResolution.create({
        data: {
          batchId: record.batchId,
          sourceRecordId: id,
          action: "IMPORT_RECORD",
          notes: `Falha ao importar: ${result.reason}`,
        },
      });
      return { ok: false, reason: result.reason };
    }

    await tx.importRecord.update({
      where: { id },
      data: {
        status: "IMPORTED",
        reviewNotes: `Importado como ${result.targetModel} ${result.targetId}`,
      },
    });
    await tx.importResolution.create({
      data: {
        batchId: record.batchId,
        sourceRecordId: id,
        action: "IMPORT_RECORD",
        targetModel: result.targetModel,
        targetId: result.targetId,
      },
    });

    return {
      ok: true,
      targetModel: result.targetModel,
      targetId: result.targetId,
      financeMonth: financeMonthFromPayload(record.detectedType, record.normalizedPayload),
    };
  });
}

async function createResolution(input: {
  recordId: string;
  action: ReviewResolutionAction;
  notes?: string | null;
  payload?: Prisma.InputJsonValue;
}) {
  const record = await getPrisma().importRecord.findUnique({
    where: { id: input.recordId },
    select: { batchId: true },
  });
  if (!record) redirectWithError("Registro de importação não encontrado");

  await getPrisma().importResolution.create({
    data: {
      batchId: record.batchId,
      sourceRecordId: input.recordId,
      action: input.action,
      notes: input.notes || null,
      ...(input.payload === undefined ? {} : { payload: input.payload }),
    },
  });
}

export async function updateImportRecordStatusAction(
  id: string,
  status: ReviewRecordStatus,
  formData?: FormData,
) {
  await requireUser();
  const notes = formData ? optionalStringField(formData, "reviewNotes") : null;
  await getPrisma().importRecord.update({
    where: { id },
    data: {
      status,
      reviewNotes: notes ?? undefined,
    },
  });

  await createResolution({
    recordId: id,
    action: status === "APPROVED" ? "APPROVE" : status === "REJECTED" ? "REJECT" : "IGNORE",
    notes,
  });

  revalidatePath("/importacao");
}

export async function updateImportBatchStatusAction(
  id: string,
  status: "PENDING_REVIEW" | "REVIEWING" | "APPROVED" | "REJECTED",
) {
  await requireUser();
  await getPrisma().importBatch.update({ where: { id }, data: { status } });
  revalidatePath("/importacao");
}

export async function updateImportRecordPayloadAction(id: string, formData: FormData) {
  await requireUser();
  const normalizedPayload = parseJsonField(formData, "normalizedPayload");
  const notes = optionalStringField(formData, "reviewNotes");
  const nextStatus = String(formData.get("nextStatus") ?? "APPROVED") as ReviewRecordStatus;

  await getPrisma().importRecord.update({
    where: { id },
    data: {
      normalizedPayload: normalizedPayload ?? Prisma.JsonNull,
      status: nextStatus,
      reviewNotes: notes ?? "Payload normalizado corrigido manualmente.",
    },
  });

  await createResolution({
    recordId: id,
    action: "CORRECT_FIELD",
    notes,
    payload: normalizedPayload ?? undefined,
  });

  revalidatePath("/importacao");
}

export async function createMergeResolutionAction(
  id: string,
  action: "MERGE_TUTOR" | "MERGE_PET",
  formData: FormData,
) {
  await requireUser();
  const canonicalName = optionalStringField(formData, "canonicalName");
  const aliases = optionalStringField(formData, "aliases");
  const notes = optionalStringField(formData, "reviewNotes");
  if (!canonicalName) redirectWithError("Informe o nome correto para registrar a mesclagem");

  const payload = {
    canonicalName,
    aliases: aliases
      ? aliases
          .split("|")
          .map((alias) => alias.trim())
          .filter(Boolean)
      : [],
  };

  await getPrisma().importRecord.update({
    where: { id },
    data: {
      status: "APPROVED",
      reviewNotes: notes ?? `${action === "MERGE_TUTOR" ? "Tutor" : "Pet"} mesclado manualmente.`,
    },
  });

  await createResolution({
    recordId: id,
    action,
    notes,
    payload,
  });

  revalidatePath("/importacao");
}

export async function importApprovedRecordAction(id: string) {
  await requireUser();
  const result = await importRecordTransaction(id);
  if (!result.ok) {
    revalidateImportTargets();
    redirect(`/importacao?error=${encodeURIComponent(result.reason)}`);
  }

  revalidateImportTargets();
  if (result.targetModel === "FinancialEntry") {
    const month = result.financeMonth ? `&month=${result.financeMonth}` : "";
    redirect(`/financeiro?saved=1${month}`);
  }
  redirect(result.alreadyImported ? "/importacao?saved=1&alreadyImported=1" : "/importacao?saved=1&imported=1");
}

export async function importApprovedBatchAction(batchId: string) {
  await requireUser();
  const records = await getPrisma().importRecord.findMany({
    where: { batchId, status: "APPROVED" },
    select: { id: true },
  });

  let imported = 0;
  let failed = 0;
  for (const record of records) {
    const result = await importRecordTransaction(record.id);
    if (result.ok) {
      if (!result.alreadyImported) imported++;
    } else {
      failed++;
    }
  }

  revalidateImportTargets();
  redirect(`/importacao?saved=1&imported=${imported}&failed=${failed}`);
}

export async function detectDuplicateTutorsAction() {
  await requireUser();
  const candidates = await buildTutorDedupeCandidates(getPrisma());
  const count = await replaceOpenDedupeCandidates("TUTOR", candidates);
  revalidatePath("/importacao");
  redirect(`/importacao?saved=1&dedupe=tutores&candidates=${count}`);
}

export async function detectDuplicatePetsAction() {
  await requireUser();
  const candidates = await buildPetDedupeCandidates(getPrisma());
  const count = await replaceOpenDedupeCandidates("PET", candidates);
  revalidatePath("/importacao");
  redirect(`/importacao?saved=1&dedupe=pets&candidates=${count}`);
}

export async function mergeTutorsAction(candidateId: string, formData: FormData) {
  const userId = await requireUser();
  const canonicalId = String(formData.get("canonicalId") ?? "");
  const mergeIds = stringValues(formData, "mergeIds");
  try {
    await mergeTutors({ candidateId, canonicalId, mergeIds, performedBy: userId });
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Falha ao mesclar tutores");
  }

  revalidatePath("/importacao");
  revalidatePath("/tutores");
  revalidatePath("/pets");
  revalidatePath("/reservas");
  redirect("/importacao?saved=1&dedupe=merged-tutors");
}

export async function mergePetsAction(candidateId: string, formData: FormData) {
  const userId = await requireUser();
  const canonicalId = String(formData.get("canonicalId") ?? "");
  const mergeIds = stringValues(formData, "mergeIds");
  try {
    await mergePets({ candidateId, canonicalId, mergeIds, performedBy: userId });
  } catch (error) {
    redirectWithError(error instanceof Error ? error.message : "Falha ao mesclar pets");
  }

  revalidatePath("/importacao");
  revalidatePath("/pets");
  revalidatePath("/tutores");
  revalidatePath("/reservas");
  redirect("/importacao?saved=1&dedupe=merged-pets");
}
