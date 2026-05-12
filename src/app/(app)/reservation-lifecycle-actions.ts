"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { refreshReservationLifecycleStatuses } from "@/lib/reservation-status";

export async function refreshReservationStatusesAction() {
  await requireUser();
  const result = await refreshReservationLifecycleStatuses();

  if (result.count > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/agenda");
    revalidatePath("/reservas");
    revalidatePath("/pets");
    revalidatePath("/tutores");
  }

  return { updated: result.count };
}
