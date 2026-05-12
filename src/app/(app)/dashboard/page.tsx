import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Bed,
  Clock,
  MoreHorizontal,
  Sun,
  Trash2,
  TrendingUp,
  Wallet,
  Footprints,
} from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { MetricCard } from "@/components/ui/metric-card";
import { PetRow } from "@/components/ui/pet-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlashMessage } from "@/components/ui/flash-message";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { getDashboardData, getReservationFormData } from "@/lib/app-data";
import { prepareRevenueChartData } from "@/lib/dashboard-chart";
import { toReservationSeasonOptions, toReservationServiceOptions } from "@/lib/reservation-form-options";
import { deleteTaskAction, toggleTaskOccurrenceAction } from "./actions";
import { NovaTarefaModal } from "./nova-tarefa-modal";
import { NovaReservaModal } from "@/app/(app)/reservas/nova-reserva-modal";

const metricIcons = { Bed, Sun, Wallet, AlertCircle };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const [dashboard, formData] = await Promise.all([getDashboardData(), getReservationFormData()]);
  const occupancy = dashboard.capacity ? Math.round((dashboard.hostedCount / dashboard.capacity) * 100) : 0;
  const occupancyWidth = Math.max(0, Math.min(occupancy, 100));
  const capacityLabel = `Capacidade do hotel: ${dashboard.hostedCount} de ${dashboard.capacity} vagas ocupadas (${occupancy}%).`;
  const today = new Date();
  const revenueChart = prepareRevenueChartData(dashboard.monthlyRevenue, today.getFullYear());
  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(today);
  const doneTasks = dashboard.tasks.filter((task) => task.done).length;

  return (
    <>
      <Topbar
        title="Bom dia, Fernanda"
        subtitle={todayLabel}
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
      <div className="content stack" style={{ paddingBottom: 0 }}>
        <FlashMessage error={sp.error} saved={sp.saved} />
      </div>
      <div className="content">
        <div className="grid-4">
          {dashboard.metrics.map((metric) => {
            const Icon = metricIcons[metric.icon as keyof typeof metricIcons];
            return <MetricCard key={metric.label} {...metric} icon={Icon} />;
          })}
        </div>

        <div className="dashboard-grid">
          <div className="stack">
            <section className="card">
              <div className="card__header">
                <div>
                  <div className="card__title">
                    <Bed /> Pets hospedados hoje
                  </div>
                  <div className="card__subtitle">
                    Capacidade do hotel - {dashboard.hostedCount} de {dashboard.capacity} vagas ocupadas
                  </div>
                </div>
                <Link className="btn btn--sm" href="/reservas">Ver todos</Link>
              </div>
              <div className="card__body card__body--flush">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Pet</th>
                      <th>Tutor</th>
                      <th>Check-in</th>
                      <th>Check-out</th>
                      <th>Status</th>
                      <th aria-label="Ações" />
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.hostedPets.length ? dashboard.hostedPets.map((row) => (
                      <tr key={row.reservationPetId}>
                        <td>
                          <PetRow name={row.pet} breed={row.breed} />
                        </td>
                        <td className="muted">{row.tutor}</td>
                        <td className="mono subtle">{row.checkIn}</td>
                        <td className="mono subtle">{row.checkOut}</td>
                        <td>
                          <StatusBadge status={row.status} />
                        </td>
                        <td>
                          <Link className="btn btn--ghost btn--icon" aria-label="Mais" href={`/reservas/${row.id}`}>
                            <MoreHorizontal />
                          </Link>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="muted">Nenhum pet hospedado hoje.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div>
                  <div className="card__title">
                    <Clock /> Próximos serviços - 48h
                  </div>
                  <div className="card__subtitle">Chegadas e saídas previstas</div>
                </div>
              </div>
              <div className="card__body card__body--flush">
                {dashboard.upcoming.length ? dashboard.upcoming.map((event, index) => (
                  <Link
                    className="row"
                    key={event.id}
                    href={"id" in event ? `/reservas/${event.id}` : "/agenda"}
                    style={{
                      padding: "12px 16px",
                      borderBottom:
                        index < dashboard.upcoming.length - 1 ? "1px solid var(--border)" : "0",
                    }}
                  >
                    <div className={`icon-circle ${event.color !== "teal" ? `icon-circle--${event.color}` : ""}`}>
                      {event.kind === "in" ? <ArrowDown /> : null}
                      {event.kind === "out" ? <ArrowUp /> : null}
                      {event.kind === "day" ? <Sun /> : null}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{event.label}</div>
                      <div className="subtle" style={{ fontSize: 11 }}>
                        {event.sub}
                      </div>
                    </div>
                    <div className="mono muted" style={{ fontSize: 12 }}>
                      {event.time}
                    </div>
                  </Link>
                )) : (
                  <div className="muted" style={{ padding: "12px 16px", fontSize: 13 }}>
                    Nenhuma chegada ou saída nas próximas 48h.
                  </div>
                )}
              </div>
            </section>

            <section className="card revenue-card">
              <div className="card__header">
                <div>
                  <div className="card__title">
                    <TrendingUp /> Faturamento mensal
                  </div>
                  <div className="card__subtitle">Últimos 6 meses</div>
                </div>
                <div className="revenue-legend" aria-label="Legenda do faturamento mensal">
                  <span><i className="revenue-legend__swatch revenue-legend__swatch--current" /> {revenueChart.currentYear}</span>
                  <span><i className="revenue-legend__swatch revenue-legend__swatch--previous" /> {revenueChart.previousYear}</span>
                </div>
              </div>
              <div className="card__body">
                <div
                  className="revenue-chart"
                  role="group"
                  aria-label={`Faturamento mensal dos últimos 6 meses. Escala até ${revenueChart.maxLabel}.`}
                >
                  {revenueChart.points.map((month, index) => (
                    <div className="revenue-chart__month" key={month.month}>
                      <div className="revenue-chart__plot">
                        <div
                          className="revenue-chart__group"
                          tabIndex={0}
                          title={month.ariaLabel}
                          aria-label={month.ariaLabel}
                          data-edge={
                            index === 0
                              ? "start"
                              : index === revenueChart.points.length - 1
                                ? "end"
                                : "middle"
                          }
                        >
                          <span className="revenue-chart__tooltip" role="tooltip">
                            <strong>{month.month}</strong>
                            <span>{revenueChart.currentYear}: {month.currentLabel}</span>
                            <span>{revenueChart.previousYear}: {month.previousLabel}</span>
                            {month.diffLabel ? (
                              <span className={`revenue-chart__diff revenue-chart__diff--${month.diffTone}`}>
                                {month.diffLabel}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className="revenue-chart__bar revenue-chart__bar--previous"
                            style={{ height: `${month.previousHeight}%` }}
                            aria-hidden="true"
                          />
                          <span
                            className="revenue-chart__bar revenue-chart__bar--current"
                            style={{ height: `${month.currentHeight}%` }}
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                      <span className="revenue-chart__label">{month.month}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="stack">
            <section className="card">
              <div className="card__header">
                <div>
                  <div className="card__title">Capacidade do hotel</div>
                  <div className="card__subtitle">de {dashboard.capacity} vagas</div>
                </div>
                <strong>{occupancy}%</strong>
              </div>
              <div className="card__body">
                <div
                  className="progress progress--interactive"
                  role="meter"
                  tabIndex={0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={occupancyWidth}
                  aria-valuetext={capacityLabel}
                  title={capacityLabel}
                >
                  <div className="progress__track">
                    <div className="progress__bar" style={{ width: `${occupancyWidth}%` }} />
                  </div>
                  <span className="progress__tooltip" role="tooltip">{capacityLabel}</span>
                </div>
                <p className="subtle" style={{ margin: "10px 0 0", fontSize: 12 }}>
                  Capacidade atual: <strong>{dashboard.hostedCount}</strong> de {dashboard.capacity} vagas.
                </p>
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div>
                  <div className="card__title">Tarefas do dia</div>
                  <div className="card__subtitle">
                    {dashboard.tasks.length ? `${doneTasks} de ${dashboard.tasks.length} concluídas` : "Nenhuma tarefa para hoje"}
                  </div>
                </div>
                <NovaTarefaModal />
              </div>
              <div className="card__body stack" style={{ gap: 8 }}>
                {dashboard.tasks.length ? dashboard.tasks.map((occurrence) => (
                  <div className="row row--between" key={occurrence.id} style={{ gap: 8, alignItems: "center" }}>
                    <form action={toggleTaskOccurrenceAction.bind(null, occurrence.id)} style={{ flex: 1 }}>
                      <button
                        type="submit"
                        className="task"
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", gap: 8, alignItems: "center", width: "100%", textAlign: "left" }}
                      >
                        <input type="checkbox" checked={occurrence.done} readOnly />
                        <div>
                          <span className={occurrence.done ? "subtle" : ""}>{occurrence.label}</span>
                          {occurrence.rangeLabel ? (
                            <span className="subtle" style={{ marginLeft: 8, fontSize: 11 }}>{occurrence.rangeLabel}</span>
                          ) : null}
                        </div>
                      </button>
                    </form>
                    <ConfirmForm action={deleteTaskAction.bind(null, occurrence.taskId)} message="Excluir esta tarefa em todos os dias?">
                      <button className="btn btn--ghost btn--icon" type="submit" aria-label="Excluir tarefa" title="Excluir">
                        <Trash2 />
                      </button>
                    </ConfirmForm>
                  </div>
                )) : (
                  <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                    Nenhuma tarefa para hoje. Use &quot;Nova tarefa&quot; acima.
                  </p>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card__header">
                <div className="card__title">
                  <Footprints /> Pet Sitter - próximas visitas
                </div>
              </div>
              <div className="card__body card__body--flush">
                {dashboard.petSitterVisits.length ? dashboard.petSitterVisits.map((visit, index) => (
                  <div
                    key={visit.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom:
                        index < dashboard.petSitterVisits.length - 1 ? "1px solid var(--border)" : "0",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{visit.pet}</div>
                    <div className="subtle" style={{ fontSize: 11 }}>
                      {visit.tutor}
                    </div>
                    <div className="mono muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {visit.time}
                    </div>
                  </div>
                )) : (
                  <div className="muted" style={{ padding: "12px 16px", fontSize: 13 }}>
                    Nenhuma visita futura cadastrada.
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
