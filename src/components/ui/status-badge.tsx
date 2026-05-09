const labels: Record<string, string> = {
  REQUESTED: "solicitada",
  CONFIRMED: "confirmada",
  IN_PROGRESS: "em andamento",
  COMPLETED: "concluida",
  CANCELLED: "cancelada",
  PENDING: "pendente",
  PARTIAL: "parcial",
  PAID: "pago",
  ACTIVE: "ativo",
  INACTIVE: "inativo",
  PENDING_REVIEW: "pendente",
  NEEDS_REVIEW: "revisao",
  APPROVED: "aprovado",
  REJECTED: "rejeitado",
  IMPORTED: "importado",
  REVIEWING: "revisando",
};

const classes: Record<string, string> = {
  REQUESTED: "badge--solicitada",
  CONFIRMED: "badge--confirmada",
  IN_PROGRESS: "badge--em-andamento",
  COMPLETED: "badge--concluida",
  CANCELLED: "badge--cancelada",
  PENDING: "badge--pendente",
  PARTIAL: "badge--parcial",
  PAID: "badge--pago",
  ACTIVE: "badge--ativo",
  INACTIVE: "badge--inativo",
  PENDING_REVIEW: "badge--pendente",
  NEEDS_REVIEW: "badge--pendente",
  APPROVED: "badge--ativo",
  REJECTED: "badge--cancelada",
  IMPORTED: "badge--pago",
  REVIEWING: "badge--em-andamento",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge ${classes[status] ?? ""}`}>
      {labels[status] ?? status.toLowerCase()}
    </span>
  );
}
