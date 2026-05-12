export function slugifyServiceName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

export function serviceKindFromName(serviceName: string) {
  const lower = serviceName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (lower.includes("creche")) return "DAYCARE" as const;
  if (lower.includes("hosped")) return "BOARDING" as const;
  if (lower.includes("visit") || lower.includes("sitter")) return "PET_SITTING" as const;
  if (lower.includes("dog walker") || lower.includes("passeio")) return "DOG_WALKER" as const;
  if (lower.includes("taxi") || lower.includes("desloc")) return "TAXI_PET" as const;
  return "OTHER" as const;
}
