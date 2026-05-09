"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPrisma } from "@/lib/db";
import { optionalStringField, stringField } from "@/lib/forms";
import { parseDatetimeLocal, startOfDay } from "@/lib/date";

/** Generate one TaskOccurrence per day between startsAt..endsAt (inclusive). */
function generateOccurrenceDates(startsAt: Date, endsAt: Date | null): Date[] {
  const start = startOfDay(startsAt);
  const end = startOfDay(endsAt ?? startsAt);
  const dates: Date[] = [];
  for (let d = new Date(start); d.getTime() <= end.getTime(); d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }
  return dates;
}

export async function createTaskAction(formData: FormData) {
  const title = stringField(formData, "title");
  if (!title) redirect("/dashboard?error=titulo-obrigatorio");

  const taskDate = parseDatetimeLocal(formData.get("taskDate")) ?? new Date();
  const endsAt = parseDatetimeLocal(formData.get("endsAt"));
  if (endsAt && endsAt.getTime() < taskDate.getTime()) {
    redirect("/dashboard?error=datas-invalidas");
  }

  const petId = optionalStringField(formData, "petId");
  const tutorId = optionalStringField(formData, "tutorId");
  const reservationId = optionalStringField(formData, "reservationId");

  const occurrenceDates = generateOccurrenceDates(taskDate, endsAt);

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
  redirect(petId ? `/pets/${petId}?saved=1` : "/dashboard?saved=1");
}

export async function toggleTaskOccurrenceAction(id: string) {
  const occurrence = await getPrisma().taskOccurrence.findUnique({
    where: { id },
    select: { status: true, task: { select: { petId: true, tutorId: true } } },
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
}

export async function deleteTaskAction(id: string) {
  const task = await getPrisma().task.findUnique({
    where: { id },
    select: { petId: true, tutorId: true },
  });
  await getPrisma().task.delete({ where: { id } });
  revalidatePath("/dashboard");
  if (task?.petId) revalidatePath(`/pets/${task.petId}`);
  if (task?.tutorId) revalidatePath(`/tutores/${task.tutorId}`);
}
