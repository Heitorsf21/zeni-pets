import { Download, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlashMessage } from "@/components/ui/flash-message";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { getFinanceData } from "@/lib/app-data";
import { brl } from "@/lib/money";
import { sumPaidCents } from "@/lib/reservation-status";
import { deleteFinancialEntryAction, markReservationPaidAction } from "./actions";
import { FinanceMonthPicker } from "./finance-month-picker";
import { NovaMovimentacaoModal } from "./nova-movimentacao-modal";

type Tab = "income" | "expense" | "all";

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; deleted?: string; saved?: string; tab?: string; month?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const tabParam: Tab = sp.tab === "income" || sp.tab === "expense" ? sp.tab : "all";
  const finance = await getFinanceData(tabParam, sp.month);
  const monthQuery = `month=${finance.monthValue}`;
  const tabHref = (tab: Tab) => tab === "all"
    ? `/financeiro?${monthQuery}`
    : `/financeiro?${monthQuery}&tab=${tab}`;

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
          <MetricCard label="Receita do mês" value={brl(finance.metrics.income)} hint="lançamentos pagos" icon={Wallet} positive />
          <MetricCard label="A receber" value={brl(finance.metrics.pending)} hint="reservas pendentes" icon={Wallet} />
          <MetricCard label="Despesas" value={brl(finance.metrics.expenses)} hint="custos do mês" icon={Wallet} />
          <MetricCard label="Lucro estimado" value={brl(finance.metrics.profit)} hint="receita - despesas" icon={Wallet} positive />
          <MetricCard label="Crédito registrado" value={brl(finance.metrics.creditsReceived)} hint="não entra na receita" icon={Wallet} />
          <MetricCard label="Crédito usado" value={brl(finance.metrics.creditsUsed)} hint="vira receita no uso" icon={Wallet} positive />
          <MetricCard label="Crédito em aberto" value={brl(finance.metrics.creditOutstanding)} hint="saldo comprometido" icon={Wallet} />
        </div>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title">Movimentação do mês</div>
              <div className="card__subtitle">{finance.monthEntriesCount} lançamentos - {finance.monthLabel.toLowerCase()}</div>
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <FinanceMonthPicker defaultValue={finance.monthValue} tab={finance.tab} />
              <div className="tabs">
                <Link href={tabHref("all")} className={`tab ${finance.tab === "all" ? "is-active" : ""}`}>Todos</Link>
                <Link href={tabHref("income")} className={`tab ${finance.tab === "income" ? "is-active" : ""}`}>Receitas</Link>
                <Link href={tabHref("expense")} className={`tab ${finance.tab === "expense" ? "is-active" : ""}`}>Despesas</Link>
              </div>
            </div>
          </div>
          <div className="card__body card__body--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Tutor</th>
                  <th>Forma</th>
                  <th>Status</th>
                  <th className="table__num">Valor</th>
                  <th aria-label="Ações" />
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
                          message="Excluir este lançamento manual?"
                        >
                          <button className="btn btn--ghost btn--icon" type="submit" aria-label="Excluir lançamento" title="Excluir lançamento">
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
              <div className="card__title">Créditos de clientes</div>
              <div className="card__subtitle">Valores guardados para uso futuro; viram receita apenas quando usados em uma reserva</div>
            </div>
          </div>
          <div className="card__body card__body--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tutor</th>
                  <th>Movimento</th>
                  <th>Descrição</th>
                  <th className="table__num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {finance.creditTransactions.length ? finance.creditTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="mono">{transaction.date}</td>
                    <td><Link href={`/tutores/${transaction.tutorId}/ficha`}>{transaction.tutor}</Link></td>
                    <td>{transaction.typeLabel}</td>
                    <td className="muted">{transaction.description}</td>
                    <td className="table__num">{transaction.amount}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="muted">Nenhum crédito movimentado neste mês.</td>
                  </tr>
                )}
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
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {finance.pendingReservations.length ? finance.pendingReservations.map((reservation) => {
                  const paid = sumPaidCents(reservation.payments);
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
                          <div className="row">
                            <select className="select" name="method" defaultValue="PIX" style={{ maxWidth: 130 }}>
                              <option value="PIX">PIX</option>
                              <option value="CASH">Dinheiro</option>
                              <option value="CARD">Cartão</option>
                              <option value="TRANSFER">Transferência</option>
                              <option value="OTHER">Outro</option>
                            </select>
                            <button className="btn btn--sm" type="submit">Marcar pago</button>
                          </div>
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
