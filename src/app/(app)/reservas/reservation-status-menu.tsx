"use client";

import { CheckCircle2, ChevronDown, PlayCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { updateReservationStatusAction } from "./actions";

type ReservationActionStatus = "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

const statusActions: Array<{
  status: ReservationActionStatus;
  label: string;
  icon: typeof CheckCircle2;
  danger?: boolean;
}> = [
  { status: "CONFIRMED", label: "Confirmar", icon: CheckCircle2 },
  { status: "IN_PROGRESS", label: "Iniciar", icon: PlayCircle },
  { status: "COMPLETED", label: "Concluir sem atraso", icon: CheckCircle2 },
  { status: "CANCELLED", label: "Cancelar", icon: XCircle, danger: true },
];

export function ReservationStatusMenu({ reservationId }: { reservationId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn"
        type="button"
        aria-expanded={open}
        aria-controls="reservation-status-actions"
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown /> Ações da reserva
      </button>
      {open ? (
        <div
          id="reservation-status-actions"
          className="stack"
          style={{
            gap: 8,
            marginTop: 8,
            padding: 8,
            border: "1px solid var(--border)",
            borderRadius: "var(--r-sm)",
            background: "var(--surface)",
          }}
        >
          {statusActions.map((action) => {
            const Icon = action.icon;
            return (
              <form key={action.status} action={updateReservationStatusAction.bind(null, reservationId, action.status)}>
                <button className={action.danger ? "btn btn--danger" : "btn"} type="submit">
                  <Icon /> {action.label}
                </button>
              </form>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
