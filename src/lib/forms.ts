import { parseCurrencyToCents } from "@/lib/money";

export function stringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function optionalStringField(formData: FormData, key: string) {
  const value = stringField(formData, key);
  return value || null;
}

export function intField(formData: FormData, key: string, fallback = 0) {
  const value = Number(stringField(formData, key));
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

export function boolField(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export function centsField(formData: FormData, key: string, fallback = 0) {
  return parseCurrencyToCents(stringField(formData, key)) ?? fallback;
}

/** Returns parsed cents or null when the field is non-empty but unparseable.
 * Returns null when the field is empty (so callers can decide if it is required). */
export function centsFieldStrict(formData: FormData, key: string): number | null {
  const raw = stringField(formData, key);
  if (!raw) return null;
  return parseCurrencyToCents(raw);
}

export function selectedValues(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value))
    .filter(Boolean);
}
