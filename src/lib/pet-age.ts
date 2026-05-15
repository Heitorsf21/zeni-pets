export type PetAgeInput = {
  ageLabel: string | null;
  ageReferenceYear: number | null;
};

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

export function displayPetAge(pet: PetAgeInput, now: Date = new Date()): string {
  const base = parseAgeFromLabel(pet.ageLabel);
  if (base == null || pet.ageReferenceYear == null) return pet.ageLabel ?? "-";
  const years = base + Math.max(now.getFullYear() - pet.ageReferenceYear, 0);
  return `${years} ${years === 1 ? "ano" : "anos"}`;
}
