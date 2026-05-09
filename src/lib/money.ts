export function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function parseCurrencyToCents(input: unknown): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.round(input * 100);
  }

  const raw = String(input)
    .trim()
    .replace(/[Rr]\$|\$|\s/g, "");

  if (!raw) return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}
