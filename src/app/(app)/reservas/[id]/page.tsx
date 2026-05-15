import { ArrowLeft, CalendarClock, CreditCard, Edit, Flag, ListChecks, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { PetAvatar } from "@/components/ui/pet-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlashMessage } from "@/components/ui/flash-message";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { getReservationDetailData, getReservationFormData } from "@/lib/app-data";
import { formatDateOnly, formatDateTimeShort, formatReservationPeriod } from "@/lib/date";
import { brl } from "@/lib/money";
import { toReservationSeasonOptions, toReservationServiceOptions } from "@/lib/reservation-form-options";
import { sumPaidCents } from "@/lib/reservation-status";
import { sumCreditBalance } from "@/lib/credits";
import {
  deleteReservationAction,
  registerPaymentAction,
  useTutorCreditAction,
} from "../actions";
import { NovaReservaModal } from "../nova-reserva-modal";
import { ReservationStatusMenu } from "../reservation-status-menu";

export default async function ReservationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const [reservation, formData] = await Promise.all([
    getReservationDetailData(id),
    getReservationFormData(),
  ]);

  if (!reservation) notFound();

  const paidCents = sumPaidCents(reservation.payments);
  const remainingCents = Math.max(reservation.totalCents - paidCents, 0);
  const tutorCreditBalanceCents = sumCreditBalance(reservation.tutor.creditTransactions);
  const usableCreditCents = Math.min(Math.max(tutorCreditBalanceCents, 0), remainingCents);
  const canDelete = reservation.status === "REQUESTED" || reservation.status === "CANCELLED";
  const deleteReservation = deleteReservationAction.bind(null, reservation.id);
  const useCredit = useTutorCreditAction.bind(null, reservation.id);

  return (
    <>
      <Topbar
        title={`${reservation.serviceType.name} - ${reservation.tutor.name}`}
        subtitle="Detalhe da reserva, pagamentos e sincronização de agenda"
        actions={
          <>
            <Link className="btn" href="/agenda"><ArrowLeft /> Agenda</Link>
            <NovaReservaModal
              tutors={formData.tutors.map((t) => ({ id: t.id, name: t.name, phone: t.phone, email: t.email }))}
              pets={formData.pets.map((p) => ({ id: p.id, name: p.name, tutor: { id: p.tutor.id, name: p.tutor.name } }))}
              serviceTypes={toReservationServiceOptions(formData.serviceTypes)}
              seasonPeriods={toReservationSeasonOptions(formData.seasonPeriods)}
              depositPercent={formData.settings?.depositPercent ?? 50}
            />
          </>
        }
      />
      <div className="content stack">
        <FlashMessage error={sp.error} saved={sp.saved} deleted={sp.deleted} />
      </div>
      <div className="content page-grid">
        <main className="stack">
          <section className="card">
            <div className="card__header">
              <div>
                <div className="card__title"><CalendarClock /> Dados da reserva</div>
                <div className="card__subtitle">{formatReservationPeriod(reservation.startsAt, reservation.endsAt)}</div>
              </div>
              <div className="row">
                <StatusBadge status={reservation.status} />
                <StatusBadge status={reservation.paymentStatus} />
              </div>
            </div>
            <div className="card__body form-grid">
              <div>
                <div className="field__label">Tutor</div>
                <Link className="linklike" href={`/tutores/${reservation.tutor.id}/ficha`}>{reservation.tutor.name}</Link>
              </div>
              <div>
                <div className="field__label">Serviço</div>
                <strong>{reservation.serviceType.name}</strong>
              </div>
              <div>
                <div className="field__label">Tabela de preço</div>
                <strong>{reservation.priceRule ? `${reservation.priceRule.label} - ${reservation.priceRule.paymentMethod}` : reservation.pricingPaymentMethod ?? "-"}</strong>
              </div>
              <div>
                <div className="field__label">Retirada</div>
                <strong>{reservation.pickupMode === "ZENI_PICKUP" ? "Zeni retira" : "Tutor entrega"}</strong>
              </div>
              <div>
                <div className="field__label">Google</div>
                <strong>{reservation.googleEventId ? "Sincronizado" : "Não sincronizado"}</strong>
              </div>
              {reservation.syncConflict ? (
                <div className="alert alert--danger" style={{ gridColumn: "1 / -1" }}>
                  Conflito de sincronização: {reservation.syncConflictReason || "revisão necessária"}
                </div>
              ) : null}
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="field__label">Observações</div>
                <p className="muted">{reservation.notes || "Sem observações."}</p>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <div>
                <div className="card__title">Pets da reserva</div>
                <div className="card__subtitle">Valores calculados por pet e adicionais</div>
              </div>
            </div>
            <div className="card__body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
              {reservation.reservationPets.map(({ pet }) => (
                <article className="card" key={pet.id} style={{ borderRadius: "var(--r-md)" }}>
                  <div className="card__body row">
                    <PetAvatar name={pet.name} size="lg" />
                    <div>
                      <Link href={`/pets/${pet.id}/ficha`}><strong>{pet.name}</strong></Link>
                      <div className="subtle" style={{ fontSize: 12 }}>{pet.breed || pet.ageLabel || "Ficha pendente"}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <div>
                <div className="card__title"><ListChecks /> Tarefas da reserva</div>
                <div className="card__subtitle">Tarefas vinculadas a esta estadia e ao pet responsável</div>
              </div>
            </div>
            <div className="card__body card__body--flush">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarefa</th>
                    <th>Pet</th>
                    <th>Início</th>
                    <th>Ocorrências</th>
                  </tr>
                </thead>
                <tbody>
                  {reservation.tasks.length ? reservation.tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <strong>{task.title}</strong>
                        {task.description ? <div className="muted">{task.description}</div> : null}
                      </td>
                      <td>{task.pet ? <Link href={`/pets/${task.pet.id}/ficha`}>{task.pet.name}</Link> : "-"}</td>
                      <td className="mono subtle">{formatDateOnly(task.taskDate)}</td>
                      <td className="muted">
                        {task.endsAt ? `Até ${formatDateOnly(task.endsAt)}` : `${task.occurrences.length} ocorrência`}
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="muted">Nenhuma tarefa vinculada a esta reserva.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <div>
                <div className="card__title"><CreditCard /> Pagamentos</div>
                <div className="card__subtitle">Sinal sugerido, saldo e lançamentos financeiros</div>
              </div>
            </div>
            <div className="card__body form-grid">
              <div><div className="field__label">Base</div><strong>{brl(reservation.baseAmountCents)}</strong></div>
              <div><div className="field__label">Taxi pet</div><strong>{brl(reservation.taxiPetCents)}</strong></div>
              <div><div className="field__label">Desconto</div><strong>{brl(reservation.discountCents)}</strong></div>
              <div><div className="field__label">Adicionais</div><strong>{brl(reservation.additionalCents)}</strong></div>
              <div><div className="field__label">Total</div><strong>{brl(reservation.totalCents)}</strong></div>
              <div><div className="field__label">Sinal sugerido</div><strong>{brl(reservation.depositSuggestedCents)}</strong></div>
              <div><div className="field__label">Saldo em aberto</div><strong>{brl(remainingCents)}</strong></div>
            </div>
            <div className="card__body card__body--flush">
              <table className="table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Forma</th>
                    <th>Status</th>
                    <th>Observação</th>
                    <th className="table__num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {reservation.payments.length ? reservation.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.paidAt ? formatDateTimeShort(payment.paidAt) : "-"}</td>
                      <td>{payment.method === "CREDIT" ? "Credito" : payment.method}</td>
                      <td><StatusBadge status={payment.status} /></td>
                      <td className="muted">{payment.notes || "-"}</td>
                      <td className="table__num">{brl(payment.amountCents)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="muted">Nenhum pagamento registrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        <aside className="stack">
          <section className="card">
            <div className="card__header">
              <div>
                <div className="card__title"><Flag /> Ações</div>
                <div className="card__subtitle">Transições operacionais da reserva</div>
              </div>
            </div>
            <div className="card__body stack" style={{ gap: 10 }}>
              <Link className="btn btn--primary" href={`/reservas/${reservation.id}/editar`}>
                <Edit /> Editar reserva
              </Link>
              <ReservationStatusMenu reservationId={reservation.id} />
              <ConfirmForm
                action={deleteReservation}
                message="Excluir esta reserva? Pagamentos e tarefas vinculados também serão removidos."
              >
                <button
                  className="btn btn--danger"
                  type="submit"
                  disabled={!canDelete}
                  title={canDelete ? "Excluir reserva" : "Só é possível excluir reservas pendentes ou canceladas"}
                >
                  <XCircle /> Excluir reserva
                </button>
              </ConfirmForm>
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <div>
                <div className="card__title"><CreditCard /> Registrar pagamento</div>
                <div className="card__subtitle">Gera lançamento financeiro</div>
              </div>
            </div>
            <form className="card__body stack" action={registerPaymentAction.bind(null, reservation.id)}>
              <label className="field">
                <span className="field__label">Valor</span>
                <input className="input" name="amountCents" defaultValue={remainingCents ? (remainingCents / 100).toFixed(2).replace(".", ",") : ""} />
              </label>
              <label className="field">
                <span className="field__label">Forma</span>
                <select className="select" name="method" defaultValue="PIX">
                  <option value="PIX">PIX</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="CARD">Cartão</option>
                  <option value="TRANSFER">Transferência</option>
                  <option value="OTHER">Outro</option>
                </select>
              </label>
              <label className="field"><span className="field__label">Observação</span><input className="input" name="notes" /></label>
              <button className="btn btn--primary" type="submit">Registrar</button>
            </form>
          </section>

          <section className="card">
            <div className="card__header">
              <div>
                <div className="card__title"><CreditCard /> Usar crédito</div>
                <div className="card__subtitle">Saldo do cliente: {brl(tutorCreditBalanceCents)}</div>
              </div>
            </div>
            <form className="card__body stack" action={useCredit}>
              <label className="field">
                <span className="field__label">Valor a usar</span>
                <input
                  className="input"
                  name="amountCents"
                  defaultValue={usableCreditCents ? (usableCreditCents / 100).toFixed(2).replace(".", ",") : ""}
                  disabled={usableCreditCents <= 0}
                />
              </label>
              <button className="btn btn--primary" type="submit" disabled={usableCreditCents <= 0}>
                Usar crédito na reserva
              </button>
              {usableCreditCents <= 0 ? (
                <p className="subtle" style={{ fontSize: 11 }}>
                  Não há crédito disponível ou saldo em aberto nesta reserva.
                </p>
              ) : null}
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
