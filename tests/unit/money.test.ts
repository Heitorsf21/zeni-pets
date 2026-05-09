import { describe, expect, it } from "vitest";
import { brl, parseCurrencyToCents } from "@/lib/money";

describe("parseCurrencyToCents", () => {
  it("returns null for null/undefined/empty", () => {
    expect(parseCurrencyToCents(null)).toBeNull();
    expect(parseCurrencyToCents(undefined)).toBeNull();
    expect(parseCurrencyToCents("")).toBeNull();
  });

  it("accepts a finite number directly", () => {
    expect(parseCurrencyToCents(80)).toBe(8_000);
    expect(parseCurrencyToCents(80.5)).toBe(8_050);
  });

  it("parses plain decimal with comma", () => {
    expect(parseCurrencyToCents("200,00")).toBe(20_000);
    expect(parseCurrencyToCents("0,99")).toBe(99);
  });

  it("parses plain decimal with dot", () => {
    expect(parseCurrencyToCents("200")).toBe(20_000);
    expect(parseCurrencyToCents("200.5")).toBe(20_050);
  });

  it("parses Brazilian format with thousand separator", () => {
    expect(parseCurrencyToCents("1.234,56")).toBe(123_456);
    expect(parseCurrencyToCents("12.345,00")).toBe(1_234_500);
  });

  it("parses values formatted by brl()", () => {
    // brl() yields "R$ X,XX" with NBSP ( ) between R$ and the number
    expect(parseCurrencyToCents(brl(8_000))).toBe(8_000);
    expect(parseCurrencyToCents(brl(123_456))).toBe(123_456);
    expect(parseCurrencyToCents(brl(0))).toBe(0);
  });

  it("parses R$ prefix with regular space", () => {
    expect(parseCurrencyToCents("R$ 200,00")).toBe(20_000);
    expect(parseCurrencyToCents("R$200,00")).toBe(20_000);
    expect(parseCurrencyToCents("r$ 80,00")).toBe(8_000);
  });

  it("returns null when only the currency symbol remains", () => {
    expect(parseCurrencyToCents("R$")).toBeNull();
    expect(parseCurrencyToCents("R$ ")).toBeNull();
  });

  it("returns null for non-numeric garbage", () => {
    expect(parseCurrencyToCents("abc")).toBeNull();
    expect(parseCurrencyToCents("R$abc")).toBeNull();
  });
});
