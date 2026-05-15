import { describe, expect, it } from "vitest";
import { contrastingTextColor, isValidHexColor } from "@/lib/colors";

const PALETTE: Record<string, string> = {
  BOARDING: "#1f6b6f",
  DAYCARE: "#9b5a16",
  PET_SITTING: "#6b4ba0",
  DOG_WALKER: "#3f7a3a",
  TAXI_PET: "#b8413a",
  ADAPTATION: "#2f6cb0",
  OTHER: "#5f6b75",
};

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function bestContrast(hex: string): number {
  const L = relativeLuminance(hex);
  const cWhite = 1.05 / (L + 0.05);
  const cBlack = (L + 0.05) / 0.05;
  return Math.max(cWhite, cBlack);
}

describe("ServiceKind color palette", () => {
  it("all entries are valid hex codes", () => {
    for (const [kind, hex] of Object.entries(PALETTE)) {
      expect(isValidHexColor(hex), `${kind} hex invalid: ${hex}`).toBe(true);
    }
  });

  it("each color meets WCAG AA (>=4.5:1) against best of black/white", () => {
    for (const [kind, hex] of Object.entries(PALETTE)) {
      const ratio = bestContrast(hex);
      expect(ratio, `${kind} (${hex}) contrast=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("contrastingTextColor returns text color that meets >=4.5:1", () => {
    for (const [kind, hex] of Object.entries(PALETTE)) {
      const text = contrastingTextColor(hex);
      const L = relativeLuminance(hex);
      const ratio = text === "#ffffff" ? 1.05 / (L + 0.05) : (L + 0.05) / 0.05;
      expect(ratio, `${kind} (${hex}) with ${text} contrast=${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("any two palette colors differ by >=25 in deltaE-like RGB distance", () => {
    const entries = Object.entries(PALETTE);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [ka, ha] = entries[i];
        const [kb, hb] = entries[j];
        const ra = parseInt(ha.slice(1, 3), 16);
        const ga = parseInt(ha.slice(3, 5), 16);
        const ba = parseInt(ha.slice(5, 7), 16);
        const rb = parseInt(hb.slice(1, 3), 16);
        const gb = parseInt(hb.slice(3, 5), 16);
        const bb = parseInt(hb.slice(5, 7), 16);
        const dist = Math.sqrt((ra - rb) ** 2 + (ga - gb) ** 2 + (ba - bb) ** 2);
        expect(dist, `${ka} vs ${kb} too close: ${dist.toFixed(1)}`).toBeGreaterThanOrEqual(25);
      }
    }
  });
});
