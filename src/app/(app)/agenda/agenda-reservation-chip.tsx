"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";

type AgendaReservationChipProps = {
  instanceId: string;
  reservationId: string;
  label: string;
  pets: string;
  tutor: string;
  service: string;
  period: string;
  status: string;
  payment: string;
  value: string;
  backgroundColor: string;
  color: string;
};

type PopoverPosition = {
  top: number;
  left: number;
};

const POPOVER_WIDTH = 300;
const EDGE_PADDING = 12;

export function AgendaReservationChip({
  instanceId,
  reservationId,
  label,
  pets,
  tutor,
  service,
  period,
  status,
  payment,
  value,
  backgroundColor,
  color,
}: AgendaReservationChipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, window.innerWidth - EDGE_PADDING * 2);
    const left = Math.min(
      Math.max(rect.left, EDGE_PADDING),
      window.innerWidth - width - EDGE_PADDING,
    );
    const popoverHeight = popoverRef.current?.offsetHeight ?? 230;
    const below = rect.bottom + 8;
    const top = below + popoverHeight <= window.innerHeight - EDGE_PADDING
      ? below
      : Math.max(rect.top - popoverHeight - 8, EDGE_PADDING);

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;

    const onOpen = (event: Event) => {
      const custom = event as CustomEvent<{ instanceId?: string }>;
      if (custom.detail?.instanceId !== instanceId) setOpen(false);
    };

    window.addEventListener("agenda-reservation-open", onOpen);
    return () => window.removeEventListener("agenda-reservation-open", onOpen);
  }, [instanceId, open]);

  useEffect(() => {
    if (!open) return;

    updatePosition();
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  const togglePopover = () => {
    setOpen((current) => {
      const next = !current;
      if (next) {
        window.dispatchEvent(
          new CustomEvent("agenda-reservation-open", { detail: { instanceId } }),
        );
      }
      return next;
    });
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="cal__bar"
        title={label}
        aria-label={`Reserva de ${pets} - ${service} - tutor ${tutor} - ${period}`}
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        aria-haspopup="dialog"
        onClick={togglePopover}
        style={{ backgroundColor, color }}
      >
        {label}
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              className="agenda-popover"
              role="dialog"
              aria-label={`Detalhes da reserva de ${pets}`}
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
              }}
            >
              <div className="agenda-popover__eyebrow">{service}</div>
              <div className="agenda-popover__title">{pets}</div>
              <dl className="agenda-popover__details">
                <div>
                  <dt>Tutor</dt>
                  <dd>{tutor}</dd>
                </div>
                <div>
                  <dt>Periodo</dt>
                  <dd>{period}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd><StatusBadge status={status} /></dd>
                </div>
                <div>
                  <dt>Pagamento</dt>
                  <dd><StatusBadge status={payment} /></dd>
                </div>
                <div>
                  <dt>Valor</dt>
                  <dd>{value}</dd>
                </div>
              </dl>
              <div className="agenda-popover__actions">
                <Link className="btn btn--sm btn--primary" href={`/reservas/${reservationId}`}>
                  Abrir reserva
                </Link>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
