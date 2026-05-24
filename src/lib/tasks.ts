import { startOfDay } from "@/lib/date";

export function taskPetLabel(input: {
  pet?: { name: string | null } | null;
  reservation?: {
    reservationPets?: Array<{ pet?: { name: string | null } | null }>;
  } | null;
}) {
  const directPet = input.pet?.name?.trim();
  if (directPet) return directPet;

  const reservationPets = input.reservation?.reservationPets
    ?.map((item) => item.pet?.name?.trim())
    .filter((name): name is string => Boolean(name));

  return reservationPets?.length ? reservationPets.join(", ") : null;
}

export function generateTaskOccurrenceDates(startsAt: Date, endsAt: Date | null): Date[] {
  const start = startOfDay(startsAt);
  const end = startOfDay(endsAt ?? startsAt);
  const dates: Date[] = [];

  for (let date = new Date(start); date.getTime() <= end.getTime(); date.setDate(date.getDate() + 1)) {
    dates.push(new Date(date));
  }

  return dates;
}
