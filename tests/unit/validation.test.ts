import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  cents,
  checkbox,
  dateOnly,
  datetimeLocal,
  formDataToObject,
  optionalCents,
  parseFormData,
  trimmedString,
  optionalTrimmedString,
} from "@/lib/validation";

function fd(entries: [string, string][]) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("validation primitives", () => {
  it("trimmedString rejects empty after trim", () => {
    expect(trimmedString.safeParse("  hello  ").success).toBe(true);
    const empty = trimmedString.safeParse("   ");
    expect(empty.success).toBe(false);
  });

  it("optionalTrimmedString returns null when blank", () => {
    expect(optionalTrimmedString.parse("")).toBeNull();
    expect(optionalTrimmedString.parse(" abc ")).toBe("abc");
  });

  it("cents accepts BRL inputs", () => {
    expect(cents.parse("R$ 200,00")).toBe(20_000);
    expect(cents.parse("100,5")).toBe(10_050);
    expect(cents.safeParse("abc").success).toBe(false);
  });

  it("optionalCents allows blank", () => {
    expect(optionalCents.parse("")).toBeNull();
    expect(optionalCents.parse("R$ 0,99")).toBe(99);
  });

  it("datetimeLocal parses ISO-like strings", () => {
    const date = datetimeLocal.parse("2026-04-27T18:00");
    expect(date instanceof Date).toBe(true);
    expect(datetimeLocal.safeParse("").success).toBe(false);
  });

  it("dateOnly parses YYYY-MM-DD", () => {
    const date = dateOnly.parse("2026-05-04");
    expect(date instanceof Date).toBe(true);
    expect(dateOnly.safeParse("not-a-date").success).toBe(false);
  });

  it("checkbox handles 'on'/'off'/empty", () => {
    expect(checkbox.parse("on")).toBe(true);
    expect(checkbox.parse("off")).toBe(false);
    expect(checkbox.parse(undefined)).toBe(false);
  });
});

describe("formDataToObject", () => {
  it("collapses single value to string", () => {
    const obj = formDataToObject(fd([["a", "1"]]));
    expect(obj).toEqual({ a: "1" });
  });

  it("preserves duplicates as arrays", () => {
    const obj = formDataToObject(fd([["a", "1"], ["a", "2"]]));
    expect(obj).toEqual({ a: ["1", "2"] });
  });
});

describe("parseFormData", () => {
  const Schema = z.object({
    name: trimmedString,
    amountCents: cents,
  });

  it("returns parsed data when valid", () => {
    const result = parseFormData(fd([["name", "Audit"], ["amountCents", "R$ 50,00"]]), Schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ name: "Audit", amountCents: 5_000 });
    }
  });

  it("returns errorKey path:message on failure", () => {
    const result = parseFormData(fd([["name", "Audit"], ["amountCents", "abc"]]), Schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorKey).toMatch(/^amountCents:/);
    }
  });
});
