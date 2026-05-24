import { describe, expect, it } from "vitest";
import { firstNameKey, normalizeDedupeName, normalizePhone, normalizedTutorPhones } from "@/lib/dedupe";

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

  it("normalizes primary and secondary tutor phones for matching", () => {
    expect(
      normalizedTutorPhones({
        phone: "+55 (31) 99910-5575",
        secondaryPhone: "(31) 98888-7777",
      }),
    ).toEqual(["31999105575", "31988887777"]);
  });

  it("extracts first-name grouping key", () => {
    expect(firstNameKey("Pietra Piotto Marcellini")).toBe("pietra");
    expect(firstNameKey("")).toBe("");
  });
});
