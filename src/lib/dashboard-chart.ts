import { brl } from "@/lib/money";

export type MonthlyRevenuePoint = {
  month: string;
  current: number;
  previous: number;
};

export type RevenueChartPoint = {
  month: string;
  current: number;
  previous: number;
  currentHeight: number;
  previousHeight: number;
  currentLabel: string;
  previousLabel: string;
  diffLabel: string | null;
  diffTone: "up" | "down" | "flat" | "none";
  ariaLabel: string;
};

export type RevenueChartData = {
  currentYear: number;
  previousYear: number;
  maxValue: number;
  maxLabel: string;
  points: RevenueChartPoint[];
};

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function displayHeight(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) return 0;
  return clampPercent(Math.max(3, (value / maxValue) * 100));
}

function roundScaleMax(value: number) {
  if (value <= 0) return 1;

  const padded = value * 1.12;
  const magnitude = 10 ** Math.max(Math.floor(Math.log10(padded)) - 1, 0);
  return Math.ceil(padded / magnitude) * magnitude;
}

function moneyFromReais(value: number) {
  return brl(Math.round(value * 100));
}

function diffInfo(current: number, previous: number, previousYear: number) {
  if (previous <= 0) {
    return {
      label: null,
      tone: "none" as const,
    };
  }

  const diff = current - previous;
  if (diff === 0) {
    return {
      label: `Sem variação vs ${previousYear}`,
      tone: "flat" as const,
    };
  }

  return {
    label: `${diff > 0 ? "+" : "-"}${moneyFromReais(Math.abs(diff))} vs ${previousYear}`,
    tone: diff > 0 ? "up" as const : "down" as const,
  };
}

export function prepareRevenueChartData(
  points: MonthlyRevenuePoint[],
  currentYear = new Date().getFullYear(),
): RevenueChartData {
  const previousYear = currentYear - 1;
  const maxValue = roundScaleMax(
    Math.max(0, ...points.flatMap((point) => [point.current, point.previous])),
  );

  return {
    currentYear,
    previousYear,
    maxValue,
    maxLabel: moneyFromReais(maxValue),
    points: points.map((point) => {
      const currentLabel = moneyFromReais(point.current);
      const previousLabel = moneyFromReais(point.previous);
      const diff = diffInfo(point.current, point.previous, previousYear);
      const ariaLabel = [
        `${point.month}: ${currentYear} ${currentLabel}`,
        `${previousYear} ${previousLabel}`,
        diff.label,
      ].filter(Boolean).join(", ");

      return {
        month: point.month,
        current: point.current,
        previous: point.previous,
        currentHeight: displayHeight(point.current, maxValue),
        previousHeight: displayHeight(point.previous, maxValue),
        currentLabel,
        previousLabel,
        diffLabel: diff.label,
        diffTone: diff.tone,
        ariaLabel,
      };
    }),
  };
}
