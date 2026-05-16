export type PetAgeInput = {
  ageLabel: string | null;
  ageReferenceYear: number | null;
};

export type PetAgeFullInput = PetAgeInput & { birthDate: Date | null };

export function parseAgeFromLabel(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function normalizeAgeInput(raw: string | null | undefined): {
  label: string | null;
  years: number | null;
} {
  if (!raw) return { label: null, years: null };
  const trimmed = raw.trim();
  if (!trimmed) return { label: null, years: null };
  const numeric = parseAgeFromLabel(trimmed);
  if (numeric == null) return { label: trimmed, years: null };
  return { label: `${numeric} ${numeric === 1 ? "ano" : "anos"}`, years: numeric };
}

export function derivePetAgeFromBirthDate(
  birthDate: Date | null,
  now: Date = new Date(),
): { years: number; label: string } | null {
  if (!birthDate) return null;
  const birth = birthDate instanceof Date ? birthDate : new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  const dayDiff = now.getDate() - birth.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years -= 1;
  }
  if (years < 0) years = 0;
  return { years, label: `${years} ${years === 1 ? "ano" : "anos"}` };
}

export function displayPetAge(
  pet: PetAgeInput | PetAgeFullInput,
  now: Date = new Date(),
): string {
  const birthDate = "birthDate" in pet ? pet.birthDate : null;
  const fromBirth = derivePetAgeFromBirthDate(birthDate, now);
  if (fromBirth) return fromBirth.label;
  const base = parseAgeFromLabel(pet.ageLabel);
  if (base == null || pet.ageReferenceYear == null) return pet.ageLabel ?? "-";
  const years = base + Math.max(now.getFullYear() - pet.ageReferenceYear, 0);
  return `${years} ${years === 1 ? "ano" : "anos"}`;
}

export function daysUntilBirthday(birthDate: Date | null, now: Date = new Date()): number | null {
  if (!birthDate) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYearBday = new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  const target = thisYearBday < today
    ? new Date(now.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate())
    : thisYearBday;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
