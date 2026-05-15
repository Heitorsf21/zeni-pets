import { describe, expect, it } from "vitest";
import { displayPetAge, normalizeAgeInput, parseAgeFromLabel } from "@/lib/pet-age";

describe("pet age helpers", () => {
  it("extracts numeric age from a label", () => {
    expect(parseAgeFromLabel("7 anos")).toBe(7);
    expect(parseAgeFromLabel("12")).toBe(12);
    expect(parseAgeFromLabel(null)).toBeNull();
    expect(parseAgeFromLabel("adulto")).toBeNull();
  });

  it("normalises raw input into label + years", () => {
    expect(normalizeAgeInput("7")).toEqual({ label: "7 anos", years: 7 });
    expect(normalizeAgeInput("1")).toEqual({ label: "1 ano", years: 1 });
    expect(normalizeAgeInput("filhote")).toEqual({ label: "filhote", years: null });
    expect(normalizeAgeInput("")).toEqual({ label: null, years: null });
  });

  it("advances the displayed age as years go by", () => {
    const pet = { ageLabel: "7 anos", ageReferenceYear: 2026 };
    expect(displayPetAge(pet, new Date(2026, 5, 1))).toBe("7 anos");
    expect(displayPetAge(pet, new Date(2027, 0, 5))).toBe("8 anos");
    expect(displayPetAge(pet, new Date(2030, 11, 31))).toBe("11 anos");
  });

  it("falls back to the raw label when the reference year is missing", () => {
    expect(displayPetAge({ ageLabel: "filhote", ageReferenceYear: null })).toBe("filhote");
  });
});
