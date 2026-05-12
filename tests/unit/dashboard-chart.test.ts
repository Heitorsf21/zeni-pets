import { describe, expect, it } from "vitest";
import { prepareRevenueChartData } from "@/lib/dashboard-chart";
import { brl } from "@/lib/money";

describe("prepareRevenueChartData", () => {
  it("keeps tall values inside the chart scale", () => {
    const chart = prepareRevenueChartData([
      { month: "JAN", current: 95_000, previous: 8_000 },
      { month: "FEV", current: 12_000, previous: 7_000 },
    ], 2026);

    expect(chart.maxValue).toBeGreaterThan(95_000);
    for (const point of chart.points) {
      expect(point.currentHeight).toBeGreaterThanOrEqual(0);
      expect(point.currentHeight).toBeLessThanOrEqual(100);
      expect(point.previousHeight).toBeGreaterThanOrEqual(0);
      expect(point.previousHeight).toBeLessThanOrEqual(100);
    }
  });

  it("keeps zero values readable without producing invalid scale", () => {
    const chart = prepareRevenueChartData([
      { month: "JAN", current: 0, previous: 0 },
    ], 2026);

    expect(chart.maxValue).toBe(1);
    expect(chart.maxLabel).toBe(brl(100));
    expect(chart.points[0]).toMatchObject({
      currentHeight: 0,
      previousHeight: 0,
      currentLabel: brl(0),
      previousLabel: brl(0),
      diffLabel: null,
      diffTone: "none",
    });
    expect(chart.points[0].ariaLabel).toContain("JAN");
  });

  it("formats year comparison and difference labels", () => {
    const chart = prepareRevenueChartData([
      { month: "MAR", current: 1_500, previous: 1_000 },
    ], 2026);

    expect(chart.currentYear).toBe(2026);
    expect(chart.previousYear).toBe(2025);
    expect(chart.points[0].currentLabel).toBe(brl(150_000));
    expect(chart.points[0].previousLabel).toBe(brl(100_000));
    expect(chart.points[0].diffLabel).toBe(`+${brl(50_000)} vs 2025`);
    expect(chart.points[0].diffTone).toBe("up");
  });
});
