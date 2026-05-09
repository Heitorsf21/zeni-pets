import { z } from "zod";
import { parseCurrencyToCents } from "@/lib/money";

/** Trim a string field; empty becomes null. */
export const trimmedString = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "obrigatorio");

export const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim() || null)
  .nullable();

/** Brazilian currency input ("R$ 100,00", "100,00", "R$ 100,00"). Returns cents (integer). */
export const cents = z
  .string()
  .transform((value, ctx) => {
    const parsed = parseCurrencyToCents(value);
    if (parsed == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "valor invalido" });
      return z.NEVER;
    }
    return parsed;
  });

/** Currency that is optional: empty -> null, otherwise must be valid. */
export const optionalCents = z
  .string()
  .transform((value, ctx) => {
    if (!value.trim()) return null;
    const parsed = parseCurrencyToCents(value);
    if (parsed == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "valor invalido" });
      return z.NEVER;
    }
    return parsed;
  });

/** Datetime-local string ("2026-04-27T18:00") to Date. */
export const datetimeLocal = z
  .string()
  .transform((value, ctx) => {
    if (!value) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "data obrigatoria" });
      return z.NEVER;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "data invalida" });
      return z.NEVER;
    }
    return date;
  });

/** Date input ("2026-04-27"). Empty values are rejected. */
export const dateOnly = z.string().transform((value, ctx) => {
  if (!value) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "data obrigatoria" });
    return z.NEVER;
  }
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "data invalida" });
    return z.NEVER;
  }
  return date;
});

export const checkbox = z
  .union([z.string(), z.literal("on"), z.literal("off"), z.undefined(), z.null()])
  .transform((value) => value === "on" || value === "true");

/** Convert FormData to a plain object, collecting multi-select values into arrays. */
export function formDataToObject(formData: FormData): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  for (const key of new Set(formData.keys())) {
    const values = formData.getAll(key).map((v) => (typeof v === "string" ? v : ""));
    result[key] = values.length > 1 ? values : (values[0] ?? "");
  }
  return result;
}

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; errorKey: string };

/** Parses FormData against a schema and returns either the typed data or an error code that
 *  can be appended to a redirect query string for the FlashMessage helper to render. */
export function parseFormData<T>(formData: FormData, schema: z.ZodSchema<T>): ParseResult<T> {
  const obj = formDataToObject(formData);
  const result = schema.safeParse(obj);
  if (result.success) return { success: true, data: result.data };

  const issue = result.error.issues[0];
  const path = issue?.path.join(".") || "campo";
  const message = issue?.message || "invalido";
  return { success: false, errorKey: `${path}:${message}` };
}
