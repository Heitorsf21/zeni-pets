import { Download, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlashMessage } from "@/components/ui/flash-message";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { getFinanceData } from "@/lib/app-data";
import { brl } from "@/lib/money";
import { deleteFinancialEntryAction, markReservationPaidAction } from "./actions";
import { NovaMovimentacaoModal } from "./nova-movimentacao-modal";

type Tab = "income" | "expense" | "all";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; deleted?: string; saved?: string; tab?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const tabParam: Tab = sp.tab === "income" || sp.tab === "expense" ? sp.tab : "all";
  const finance = await getFinanceData(tabParam);

  return (
    <>
      <Topbar
        title="Financeiro"
        subtitle={finance.monthLabel}
        actions={
          <>
            <a className="btn" href="/api/financeiro/export"><Download /> Exportar</a>
            <NovaMovimentacaoModal />
          </>
        }
      />
      <div className="content stack">
        <FlashMessage error={sp.error} deleted={sp.deleted} saved={sp.saved} />
        <div className="grid-4">
          <MetricCard label="Receita do mes" value={brl(finance.metrics.income)} hint="lancamentos pagos" icon={Wallet} positive />
          <MetricCard label="A receber" value={brl(finance.metrics.pending)} hint="reservas pendentes" icon={Wallet} />
          <MetricCard label="Despesas" value={brl(finance.metrics.expenses)} hint="custos do mes" icon={Wallet} />
          <MetricCard label="Lucro estimado" value={brl(finance.metrics.profit)} hint="receita - despesas" icon={Wallet} positive />
        </div>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title">Movimentacao do mes</div>
              <div className="card__subtitle">{finance.monthEntriesCount} lancamentos - {finance.monthLabel.toLowerCase()}</div>
            </div>
            <div className="tabs">
              <Link href="/financeiro" className={`tab ${finance.tab === "all" ? "is-active" : ""}`}>Todos</Link>
              <Link href="/financeiro?tab=income" className={`tab ${finance.tab === "income" ? "is-active" : ""}`}>Receitas</Link>
              <Link href="/financeiro?tab=expense" className={`tab ${finance.tab === "expense" ? "is-active" : ""}`}>Despesas</Link>
            </div>
          </div>
          <div className="card__body card__body--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descricao</th>
                  <th>Tutor</th>
                  <th>Forma</th>
                  <th>Status</th>
                  <th className="table__num">Valor</th>
                  <th aria-label="Acoes" />
                </tr>
              </thead>
              <tbody>
                {finance.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono">{entry.date}</td>
                    <td>{entry.description}</td>
                    <td className="muted">{entry.tutor}</td>
                    <td>{entry.method}</td>
                    <td><StatusBadge status={entry.status} /></td>
                    <td className="table__num">{entry.amount}</td>
                    <td>
                      {entry.isManual ? (
                        <ConfirmForm
                          action={deleteFinancialEntryAction.bind(null, entry.id)}
                          message="Excluir este lancamento manual?"
                        >
                          <button className="btn btn--ghost btn--icon" type="submit" aria-label="Excluir lancamento" title="Excluir lancamento">
                            <Trash2 />
                          </button>
                        </ConfirmForm>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title">A receber</div>
              <div className="card__subtitle">Reservas pendentes podem ser quitadas rapidamente</div>
            </div>
          </div>
          <div className="card__body card__body--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Tutor</th>
                  <th>Status</th>
                  <th className="table__num">Total</th>
                  <th className="table__num">Pago</th>
                  <th className="table__num">Aberto</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody>
                {finance.pendingReservations.length ? finance.pendingReservations.map((reservation) => {
                  const paid = reservation.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
                  const open = Math.max(reservation.totalCents - paid, 0);
                  return (
                    <tr key={reservation.id}>
                      <td>{reservation.tutor.name}</td>
                      <td><StatusBadge status={reservation.paymentStatus} /></td>
                      <td className="table__num">{brl(reservation.totalCents)}</td>
                      <td className="table__num">{brl(paid)}</td>
                      <td className="table__num">{brl(open)}</td>
                      <td>
                        <form action={markReservationPaidAction.bind(null, reservation.id)}>
                          <button className="btn btn--sm" type="submit">Marcar pago</button>
                        </form>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="muted">Nenhuma reserva pendente.</td>
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
