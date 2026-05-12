"use client";

import { Filter, Search } from "lucide-react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "Solicitada",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  CANCELLED: "Cancelada",
};

type Option = { id: string; name: string };

type Filters = {
  scope: "upcoming" | "all";
  status: string[];
  paymentStatus: string[];
  serviceTypeId: string;
  tutorId: string;
  from: string;
  to: string;
  q: string;
};

type Props = {
  filters: Filters;
  statusOptions: readonly string[];
  paymentStatusOptions: readonly string[];
  serviceTypes: Option[];
  tutors: Option[];
  activeCount: number;
};

export function FiltrosReservasModal({
  filters,
  statusOptions,
  paymentStatusOptions,
  serviceTypes,
  tutors,
  activeCount,
}: Props) {
  const statusValue = filters.status.join(",");
  const clearHref = filters.scope === "all" ? "/reservas?scope=all" : "/reservas";

  return (
    <Modal
      trigger={
        <button type="button" className="btn">
          <Filter /> Filtros
          {activeCount > 0 ? (
            <span className="badge badge--ativo" style={{ marginLeft: 6 }}>{activeCount}</span>
          ) : null}
        </button>
      }
      title="Filtrar reservas"
      width={640}
    >
      <form className="form-grid" method="get" action="/reservas">
        <input type="hidden" name="scope" value={filters.scope} />
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Buscar tutor ou pet</span>
          <div className="search">
            <Search />
            <input
              className="input input--with-icon"
              name="q"
              defaultValue={filters.q}
              placeholder="Nome do tutor ou pet"
            />
          </div>
        </label>
        <label className="field">
          <span className="field__label">Status</span>
          <select className="select" name="status" defaultValue={statusValue}>
            <option value="">Todos</option>
            <option value="REQUESTED,CONFIRMED,IN_PROGRESS">Abertas</option>
            <option value="CONFIRMED,IN_PROGRESS">Confirmadas e em andamento</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Pagamento</span>
          <select className="select" name="paymentStatus" defaultValue={filters.paymentStatus[0] ?? ""}>
            <option value="">Todos</option>
            {paymentStatusOptions.map((status) => (
              <option key={status} value={status}>{PAYMENT_LABELS[status]}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Serviço</span>
          <select className="select" name="serviceTypeId" defaultValue={filters.serviceTypeId}>
            <option value="">Todos</option>
            {serviceTypes.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Tutor</span>
          <select className="select" name="tutorId" defaultValue={filters.tutorId}>
            <option value="">Todos</option>
            {tutors.map((tutor) => (
              <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Início a partir de</span>
          <input className="input" name="from" type="date" defaultValue={filters.from} />
        </label>
        <label className="field">
          <span className="field__label">Término até</span>
          <input className="input" name="to" type="date" defaultValue={filters.to} />
        </label>
        <div
          className="row"
          style={{ gridColumn: "1 / -1", justifyContent: "space-between", marginTop: 4 }}
        >
          <Link className="btn" href={clearHref}>Limpar filtros</Link>
          <button className="btn btn--primary" type="submit">Aplicar</button>
        </div>
      </form>
    </Modal>
  );
}
