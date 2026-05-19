"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import { optionalStringField, stringField } from "@/lib/forms";
import { parseDatetimeLocal, startOfDay } from "@/lib/date";
import { generateTaskOccurrenceDates } from "@/lib/tasks";

export async function createTaskAction(formData: FormData) {
  await requireUser();
  const title = stringField(formData, "title");
  if (!title) redirect("/dashboard?error=titulo-obrigatorio");

  const taskDate = parseDatetimeLocal(formData.get("taskDate")) ?? new Date();
  const endsAt = parseDatetimeLocal(formData.get("endsAt"));
  if (endsAt && endsAt.getTime() < taskDate.getTime()) {
    redirect("/dashboard?error=tarefa-datas-invalidas");
  }

  const petId = optionalStringField(formData, "petId");
  const tutorId = optionalStringField(formData, "tutorId");
  const reservationId = optionalStringField(formData, "reservationId");

  const occurrenceDates = generateTaskOccurrenceDates(taskDate, endsAt);

  await getPrisma().task.create({
    data: {
      title,
      description: optionalStringField(formData, "description"),
      taskDate,
      endsAt,
      status: "PENDING",
      source: "MANUAL",
      tutorId,
      petId,
      reservationId,
      occurrences: {
        create: occurrenceDates.map((date) => ({ occurrenceDate: date })),
      },
    },
  });

  revalidatePath("/dashboard");
  if (petId) revalidatePath(`/pets/${petId}`);
  if (tutorId) revalidatePath(`/tutores/${tutorId}`);
  if (reservationId) revalidatePath(`/reservas/${reservationId}`);
  redirect(petId ? `/pets/${petId}?saved=1` : "/dashboard?saved=1");
}

export async function updateTaskAction(id: string, formData: FormData) {
  await requireUser();
  const title = stringField(formData, "title");
  if (!title) redirect("/dashboard?error=titulo-obrigatorio");

  const taskDate = parseDatetimeLocal(formData.get("taskDate"));
  if (!taskDate) redirect("/dashboard?error=dados-obrigatorios");

  const endsAt = parseDatetimeLocal(formData.get("endsAt"));
  if (endsAt && endsAt.getTime() < taskDate.getTime()) {
    redirect("/dashboard?error=tarefa-datas-invalidas");
  }

  const prisma = getPrisma();
  const task = await prisma.task.findUnique({
    where: { id },
    select: { petId: true, tutorId: true, reservationId: true },
  });
  if (!task) redirect("/dashboard?error=tarefa-nao-encontrada");

  const occurrenceDates = generateTaskOccurrenceDates(taskDate, endsAt);

  await prisma.$transaction(async (tx) => {
    const existingOccurrences = await tx.taskOccurrence.findMany({
      where: { taskId: id },
      select: { occurrenceDate: true, status: true, completedAt: true },
    });
    const statusByDate = new Map(
      existingOccurrences.map((occurrence) => [
        startOfDay(occurrence.occurrenceDate).getTime(),
        { status: occurrence.status, completedAt: occurrence.completedAt },
      ]),
    );

    await tx.task.update({
      where: { id },
      data: {
        title,
        description: optionalStringField(formData, "description"),
        taskDate,
        endsAt,
      },
    });
    await tx.taskOccurrence.deleteMany({ where: { taskId: id } });
    await tx.taskOccurrence.createMany({
      data: occurrenceDates.map((date) => {
        const existing = statusByDate.get(startOfDay(date).getTime());
        return {
          taskId: id,
          occurrenceDate: date,
          status: existing?.status ?? "PENDING",
          completedAt: existing?.completedAt ?? null,
        };
      }),
    });
  });

  revalidatePath("/dashboard");
  if (task.petId) revalidatePath(`/pets/${task.petId}`);
  if (task.tutorId) revalidatePath(`/tutores/${task.tutorId}`);
  if (task.reservationId) revalidatePath(`/reservas/${task.reservationId}`);
  redirect("/dashboard?saved=1");
}

export async function toggleTaskOccurrenceAction(id: string) {
  await requireUser();
  const occurrence = await getPrisma().taskOccurrence.findUnique({
    where: { id },
    select: { status: true, task: { select: { petId: true, tutorId: true, reservationId: true } } },
  });
  if (!occurrence) redirect("/dashboard?error=tarefa-nao-encontrada");

  const nextStatus = occurrence.status === "DONE" ? "PENDING" : "DONE";
  await getPrisma().taskOccurrence.update({
    where: { id },
    data: {
      status: nextStatus,
      completedAt: nextStatus === "DONE" ? new Date() : null,
    },
  });

  revalidatePath("/dashboard");
  if (occurrence.task.petId) revalidatePath(`/pets/${occurrence.task.petId}`);
  if (occurrence.task.tutorId) revalidatePath(`/tutores/${occurrence.task.tutorId}`);
  if (occurrence.task.reservationId) revalidatePath(`/reservas/${occurrence.task.reservationId}`);
}

export async function deleteTaskAction(id: string) {
  await requireUser();
  const task = await getPrisma().task.findUnique({
    where: { id },
    select: { petId: true, tutorId: true, reservationId: true },
  });
  if (!task) redirect("/dashboard?error=tarefa-nao-encontrada");
  await getPrisma().task.delete({ where: { id } });
  revalidatePath("/dashboard");
  if (task.petId) revalidatePath(`/pets/${task.petId}`);
  if (task.tutorId) revalidatePath(`/tutores/${task.tutorId}`);
  if (task.reservationId) revalidatePath(`/reservas/${task.reservationId}`);
}
