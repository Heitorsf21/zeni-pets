import { describe, expect, it } from "vitest";
import { firstNameKey, normalizeDedupeName, normalizePhone } from "@/lib/dedupe";

describe("dedupe normalization", () => {
  it("removes accents, duplicated spaces, punctuation and cadastro suffixes", () => {
    expect(normalizeDedupeName("Alessandra Milagres Peron França(Cadastrada)!")).toBe(
      "alessandra milagres peron franca",
    );
    expect(normalizeDedupeName("Camila  Paixão")).toBe("camila paixao");
  });

  it("normalizes phone numbers for matching", () => {
    expect(normalizePhone("+55 (31) 99910-5575")).toBe("31999105575");
  });

  it("extracts first-name grouping key", () => {
    expect(firstNameKey("Pietra Piotto Marcellini")).toBe("pietra");
    expect(firstNameKey("")).toBe("");
  });
});
