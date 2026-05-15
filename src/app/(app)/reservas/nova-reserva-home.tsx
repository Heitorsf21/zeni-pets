"use client";

import { ChevronRight } from "lucide-react";
import type { ReservationServiceOption } from "@/lib/reservation-form-options";
import { contrastingTextColor } from "@/lib/colors";

type ServiceOptionWithColor = ReservationServiceOption & { color?: string | null };

type Props = {
  serviceTypes: ServiceOptionWithColor[];
  onSelect: (serviceTypeId: string) => void;
};

function descriptionForKind(kind: string): string {
  switch (kind) {
    case "BOARDING":
      return "Estadia com check-in e check-out (por noite).";
    case "DAYCARE":
      return "Período diurno, em 1 dia. Sem pernoite.";
    case "PET_SITTING":
      return "Visita domiciliar em dias específicos (pode ser alternado).";
    case "TAXI_PET":
      return "Transporte. Valor cobrado manualmente.";
    case "DOG_WALKER":
      return "Passeio agendado.";
    case "ADAPTATION":
      return "Sessão de adaptação à hospedagem.";
    default:
      return "Outro serviço.";
  }
}

export function NovaReservaHome({ serviceTypes, onSelect }: Props) {
  return (
    <div className="stack" style={{ gap: 12 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Escolha o tipo de serviço pra abrir o formulário com as regras certas.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        {serviceTypes.map((service) => {
          const color = service.color ?? "#1f6b6f";
          const text = contrastingTextColor(color);
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                textAlign: "left",
                padding: 14,
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--bg-elevated)",
                cursor: "pointer",
                transition: "transform 120ms ease, box-shadow 120ms ease",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.boxShadow = "0 6px 18px rgba(15, 23, 42, 0.08)";
                event.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.boxShadow = "";
                event.currentTarget.style.transform = "";
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span
                  aria-hidden
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: color,
                    color: text,
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {service.name.slice(0, 1).toUpperCase()}
                </span>
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>{service.name}</strong>
                  <span className="subtle" style={{ fontSize: 11 }}>
                    {descriptionForKind(service.kind)}
                  </span>
                </span>
              </span>
              <ChevronRight style={{ width: 18, height: 18, color: "var(--muted)" }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
