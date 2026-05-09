import { ArrowLeft, CalendarClock, CheckCircle2, CreditCard, Flag, PauseCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { PetAvatar } from "@/components/ui/pet-avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlashMessage } from "@/components/ui/flash-message";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { getReservationDetailData, getReservationFormData } from "@/lib/app-data";
import { formatDateTimeShort, toDatetimeLocalValue } from "@/lib/date";
import { brl } from "@/lib/money";
import {
  concludeWithLateFeeAction,
  deleteReservationAction,
  registerPaymentAction,
  updateReservationStatusAction,
} from "../actions";
import { NovaReservaModal } from "../nova-reserva-modal";

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

  const paidCents = reservation.payments
    .filter((payment) => payment.status === "PAID")
    .reduce((total, payment) => total + payment.amountCents, 0);
  const remainingCents = Math.max(reservation.totalCents - paidCents, 0);
  const canDelete = reservation.status === "REQUESTED" || reservation.status === "CANCELLED";
  const deleteReservation = deleteReservationAction.bind(null, reservation.id);

  return (
    <>
      <Topbar
        title={`${reservation.serviceType.name} - ${reservation.tutor.name}`}
        subtitle="Detalhe da reserva, pagamentos e sincronizacao de agenda"
        actions={
          <>
            <Link className="btn" href="/agenda"><ArrowLeft /> Agenda</Link>
            <NovaReservaModal
              tutors={formData.tutors.map((t) => ({ id: t.id, name: t.name }))}
              pets={formData.pets.map((p) => ({ id: p.id, name: p.name, tutor: { id: p.tutor.id, name: p.tutor.name } }))}
              serviceTypes={formData.serviceTypes.map((s) => ({ id: s.id, name: s.name }))}
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
                <div className="card__subtitle">{formatDateTimeShort(reservation.startsAt)} - {formatDateTimeShort(reservation.endsAt)}</div>
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
                <div className="field__label">Servico</div>
                <strong>{reservation.serviceType.name}</strong>
              </div>
              <div>
                <div className="field__label">Retirada</div>
                <strong>{reservation.pickupMode === "ZENI_PICKUP" ? "Zeni retira" : "Tutor entrega"}</strong>
              </div>
              <div>
                <div className="field__label">Google</div>
                <strong>{reservation.googleEventId ? "Sincronizado" : "Nao sincronizado"}</strong>
              </div>
              {reservation.syncConflict ? (
                <div className="alert alert--danger" style={{ gridColumn: "1 / -1" }}>
                  Conflito de sincronizacao: {reservation.syncConflictReason || "revisao necessaria"}
                </div>
              ) : null}
              <div style={{ gridColumn: "1 / -1" }}>
                <div className="field__label">Observacoes</div>
                <p className="muted">{reservation.notes || "Sem observacoes."}</p>
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
                <div className="card__title"><CreditCard /> Pagamentos</div>
                <div className="card__subtitle">Sinal sugerido, saldo e lancamentos financeiros</div>
              </div>
            </div>
            <div className="card__body form-grid">
              <div><div className="field__label">Base</div><strong>{brl(reservation.baseAmountCents)}</strong></div>
              <div><div className="field__label">Taxi pet</div><strong>{brl(reservation.taxiPetCents)}</strong></div>
              <div><div className="field__label">Desconto</div><strong>{brl(reservation.discountCents)}</strong></div>
              <div><div className="field__label">Adicionais</div><strong>{brl(reservation.additionalCents)}</strong></div>
              <div><div className="field__label">Atraso</div><strong>{brl(reservation.lateFeeCents)}</strong></div>
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
                    <th>Observacao</th>
                    <th className="table__num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {reservation.payments.length ? reservation.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.paidAt ? formatDateTimeShort(payment.paidAt) : "-"}</td>
                      <td>{payment.method}</td>
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
                <div className="card__title"><Flag /> Acoes</div>
                <div className="card__subtitle">Transicoes operacionais do MVP</div>
              </div>
            </div>
            <div className="card__body stack" style={{ gap: 10 }}>
              <form action={updateReservationStatusAction.bind(null, reservation.id, "CONFIRMED")}><button className="btn" type="submit"><CheckCircle2 /> Confirmar</button></form>
              <form action={updateReservationStatusAction.bind(null, reservation.id, "IN_PROGRESS")}><button className="btn" type="submit"><PauseCircle /> Iniciar</button></form>
              <form action={updateReservationStatusAction.bind(null, reservation.id, "COMPLETED")}><button className="btn" type="submit"><CheckCircle2 /> Concluir sem atraso</button></form>
              <form action={updateReservationStatusAction.bind(null, reservation.id, "CANCELLED")}><button className="btn" type="submit"><XCircle /> Cancelar</button></form>
              <ConfirmForm
                action={deleteReservation}
                message="Excluir esta reserva? Pagamentos e tarefas vinculados tambem serao removidos."
              >
                <button
                  className="btn btn--danger"
                  type="submit"
                  disabled={!canDelete}
                  title={canDelete ? "Excluir reserva" : "So e possivel excluir reservas pendentes ou canceladas"}
                >
                  <XCircle /> Excluir reserva
                </button>
              </ConfirmForm>
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <div>
                <div className="card__title">Concluir com atraso</div>
                <div className="card__subtitle">Calcula hora iniciada automaticamente</div>
              </div>
            </div>
            <form className="card__body stack" action={concludeWithLateFeeAction.bind(null, reservation.id)}>
              <label className="field">
                <span className="field__label">Saida real</span>
                <input className="input" name="actualEndedAt" type="datetime-local" defaultValue={toDatetimeLocalValue(reservation.endsAt)} />
              </label>
              <button className="btn btn--primary" type="submit">Calcular e concluir</button>
            </form>
          </section>

          <section className="card">
            <div className="card__header">
              <div>
                <div className="card__title"><CreditCard /> Registrar pagamento</div>
                <div className="card__subtitle">Gera lancamento financeiro</div>
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
                  <option value="CARD">Cartao</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="OTHER">Outro</option>
                </select>
              </label>
              <label className="field"><span className="field__label">Observacao</span><input className="input" name="notes" /></label>
              <button className="btn btn--primary" type="submit">Registrar</button>
            </form>
          </section>
        </aside>
      </div>
    </>
  );
}
