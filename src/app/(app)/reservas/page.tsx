import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlashMessage } from "@/components/ui/flash-message";
import { getReservationFormData, getReservationsListData } from "@/lib/app-data";
import { NovaReservaModal } from "./nova-reserva-modal";
import { FiltrosReservasModal } from "./filtros-modal";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
function multiParam(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return value.split(",").filter(Boolean);
}

function buildHref(filters: Record<string, string | number | string[]>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page })) {
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
    } else if (value != null) {
      const text = String(value);
      if (text !== "") params.set(key, text);
    }
  }
  const query = params.toString();
  return query ? `/reservas?${query}` : "/reservas";
}

export default async function ReservasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const [data, formData] = await Promise.all([
    getReservationsListData({
      status: multiParam(params.status),
      paymentStatus: multiParam(params.paymentStatus),
      serviceTypeId: firstParam(params.serviceTypeId),
      tutorId: firstParam(params.tutorId),
      from: firstParam(params.from),
      to: firstParam(params.to),
      q: firstParam(params.q),
      page: Number(firstParam(params.page) ?? 1) || 1,
    }),
    getReservationFormData(),
  ]);

  const error = firstParam(params.error);
  const deleted = firstParam(params.deleted);

  const activeCount =
    (data.filters.status.length ? 1 : 0)
    + (data.filters.paymentStatus.length ? 1 : 0)
    + (data.filters.serviceTypeId ? 1 : 0)
    + (data.filters.tutorId ? 1 : 0)
    + (data.filters.from ? 1 : 0)
    + (data.filters.to ? 1 : 0)
    + (data.filters.q ? 1 : 0);

  return (
    <>
      <Topbar
        title="Reservas"
        subtitle={`${data.total} reservas no filtro atual`}
        actions={
          <>
            <FiltrosReservasModal
              filters={data.filters}
              statusOptions={data.statusOptions}
              paymentStatusOptions={data.paymentStatusOptions}
              serviceTypes={data.serviceTypes.map((s) => ({ id: s.id, name: s.name }))}
              tutors={data.tutors.map((t) => ({ id: t.id, name: t.name }))}
              activeCount={activeCount}
            />
            <NovaReservaModal
              tutors={formData.tutors.map((t) => ({ id: t.id, name: t.name }))}
              pets={formData.pets.map((p) => ({ id: p.id, name: p.name, tutor: { id: p.tutor.id, name: p.tutor.name } }))}
              serviceTypes={formData.serviceTypes.map((s) => ({ id: s.id, name: s.name }))}
            />
          </>
        }
      />
      <div className="content stack">
        <FlashMessage error={error} deleted={deleted} />

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><CalendarClock /> Lista</div>
              <div className="card__subtitle">Pagina {data.page} de {data.totalPages}</div>
            </div>
            <div className="row">
              <Link className="btn btn--sm" href={buildHref(data.filters, Math.max(data.page - 1, 1))}>Anterior</Link>
              <Link className="btn btn--sm" href={buildHref(data.filters, Math.min(data.page + 1, data.totalPages))}>Proxima</Link>
            </div>
          </div>
          <div className="card__body card__body--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Tutor</th>
                  <th>Pets</th>
                  <th>Servico</th>
                  <th>Periodo</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                  <th className="table__num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.reservations.length ? data.reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td><Link href={`/reservas/${reservation.id}`}>{reservation.tutor}</Link></td>
                    <td className="muted">{reservation.pets || "-"}</td>
                    <td className="muted">{reservation.type}</td>
                    <td className="mono subtle">{reservation.period}</td>
                    <td><StatusBadge status={reservation.status} /></td>
                    <td><StatusBadge status={reservation.payment} /></td>
                    <td className="table__num">{reservation.value}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="muted">Nenhuma reserva encontrada para os filtros atuais.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
