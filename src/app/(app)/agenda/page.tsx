import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlashMessage } from "@/components/ui/flash-message";
import {
  getReservationFormData,
  getReservationsByMonthData,
  getUpcomingReservationsData,
} from "@/lib/app-data";
import { toReservationSeasonOptions, toReservationServiceOptions } from "@/lib/reservation-form-options";
import { NovaReservaModal } from "@/app/(app)/reservas/nova-reserva-modal";
import { AgendaMonthPicker } from "./month-picker";

const days = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const MONTH_LABELS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function buildMonthGrid(reference: Date) {
  const first = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const lastDay = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  const dayOfWeek = (first.getDay() + 6) % 7;
  return { dayOfWeek, lastDay };
}

function parseMonthParam(value: string | undefined): Date {
  if (!value) return new Date();
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return new Date();
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (Number.isNaN(year) || month < 0 || month > 11) return new Date();
  return new Date(year, month, 1);
}

function monthHref(date: Date) {
  return `/agenda?month=${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; deleted?: string; month?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const today = new Date();
  const reference = parseMonthParam(sp.month);
  const monthLabel = `${MONTH_LABELS_PT[reference.getMonth()]} ${reference.getFullYear()}`;
  const monthValue = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}`;
  const grid = buildMonthGrid(reference);

  const [reservations, upcoming, formData] = await Promise.all([
    getReservationsByMonthData(reference.getFullYear(), reference.getMonth()),
    getUpcomingReservationsData(14),
    getReservationFormData(),
  ]);

  const prevMonth = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  const nextMonth = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
  const isCurrentMonth =
    reference.getMonth() === today.getMonth() && reference.getFullYear() === today.getFullYear();

  return (
    <>
      <Topbar
        title="Google Agenda"
        subtitle="Eventos sincronizados com a sua agenda do Google"
        actions={
          <NovaReservaModal
            tutors={formData.tutors.map((t) => ({ id: t.id, name: t.name }))}
            pets={formData.pets.map((p) => ({ id: p.id, name: p.name, tutor: { id: p.tutor.id, name: p.tutor.name } }))}
            serviceTypes={toReservationServiceOptions(formData.serviceTypes)}
            seasonPeriods={toReservationSeasonOptions(formData.seasonPeriods)}
            depositPercent={formData.settings?.depositPercent ?? 50}
          />
        }
      />
      <div className="content stack">
        <FlashMessage error={sp.error} deleted={sp.deleted} />
        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title">
                <CalendarDays /> {monthLabel}
              </div>
              <div className="card__subtitle">Use as setas para navegar entre meses</div>
            </div>
            <div className="row">
              <Link className="btn btn--sm" href={monthHref(prevMonth)} aria-label="Mês anterior">
                <ChevronLeft />
              </Link>
              <AgendaMonthPicker defaultValue={monthValue} />
              {isCurrentMonth ? null : (
                <Link className="btn btn--sm" href="/agenda" title="Voltar para o mês atual">Mês atual</Link>
              )}
              <Link className="btn btn--sm" href={monthHref(nextMonth)} aria-label="Próximo mês">
                <ChevronRight />
              </Link>
            </div>
          </div>
          <div className="card__body">
            <div className="cal">
              {days.map((day) => (
                <div className="cal__day cal__head" key={day}>
                  {day}
                </div>
              ))}
              {Array.from({ length: grid.dayOfWeek }, (_, idx) => (
                <div className="cal__day cal__day--empty" key={`pad-${idx}`} />
              ))}
              {Array.from({ length: grid.lastDay }, (_, idx) => idx + 1).map((date) => {
                const isToday =
                  date === today.getDate()
                  && reference.getMonth() === today.getMonth()
                  && reference.getFullYear() === today.getFullYear();
                const dayReservations = reservations.filter((reservation) =>
                  reservation.startsAt.getDate() === date
                  && reservation.startsAt.getMonth() === reference.getMonth()
                  && reservation.startsAt.getFullYear() === reference.getFullYear(),
                );
                return (
                  <div className={`cal__day ${isToday ? "cal__day--today" : ""}`} key={date}>
                    <div className="cal__date">{date}</div>
                    {dayReservations.slice(0, 3).map((reservation, index) => (
                      <Link
                        className={`cal__chip ${index === 1 ? "cal__chip--lilac" : index === 2 ? "cal__chip--warm" : ""}`}
                        href={`/reservas/${reservation.id}`}
                        key={reservation.id}
                      >
                        {reservation.type} - {reservation.pets}
                      </Link>
                    ))}
                    {dayReservations.length > 3 ? (
                      <div className="subtle" style={{ fontSize: 10, marginTop: 2 }}>
                        +{dayReservations.length - 3} mais
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title">Próximas reservas</div>
              <div className="card__subtitle">{upcoming.length} reservas nos próximos 14 dias</div>
            </div>
          </div>
          <div className="card__body card__body--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Tutor</th>
                  <th>Tipo</th>
                  <th>Período</th>
                  <th>Status</th>
                  <th>Pagamento</th>
                  <th className="table__num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.length ? upcoming.map((reservation) => (
                  <tr key={reservation.id}>
                    <td><Link href={`/reservas/${reservation.id}`}>{reservation.tutor}</Link></td>
                    <td className="muted">{reservation.type}</td>
                    <td className="mono subtle">{reservation.period}</td>
                    <td><StatusBadge status={reservation.status} /></td>
                    <td><StatusBadge status={reservation.payment} /></td>
                    <td className="table__num">{reservation.value}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="muted">Nenhuma reserva nos próximos 14 dias.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
