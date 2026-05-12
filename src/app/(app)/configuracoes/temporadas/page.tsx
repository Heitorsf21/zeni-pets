import { CalendarRange, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { FlashMessage } from "@/components/ui/flash-message";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { getPrisma } from "@/lib/db";
import { formatDateShort } from "@/lib/date";
import {
  createSeasonAction,
  deleteSeasonAction,
  updateSeasonAction,
} from "./actions";

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function TemporadasPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const seasons = await getPrisma().seasonPeriod.findMany({ orderBy: { startsAt: "asc" } });

  return (
    <>
      <Topbar
        title="Temporadas"
        subtitle="Janelas de alta temporada que aplicam preços diferenciados"
        actions={<Link className="btn" href="/configuracoes">Voltar</Link>}
      />
      <div className="content stack">
        <FlashMessage error={sp.error} saved={sp.saved} deleted={sp.deleted} />

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><Plus /> Nova temporada</div>
              <div className="card__subtitle">Criar uma janela em que os preços de alta temporada são aplicados</div>
            </div>
          </div>
          <form className="card__body form-grid" action={createSeasonAction}>
            <label className="field">
              <span className="field__label">Nome</span>
              <input className="input" name="name" placeholder="Carnaval 2026" required />
            </label>
            <label className="field">
              <span className="field__label">Início</span>
              <input className="input" name="startsAt" type="date" required />
            </label>
            <label className="field">
              <span className="field__label">Termino</span>
              <input className="input" name="endsAt" type="date" required />
            </label>
            <label className="check">
              <input type="checkbox" name="isActive" defaultChecked /> Ativa
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="field__label">Observações</span>
              <input className="input" name="notes" />
            </label>
            <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
              <button className="btn btn--primary" type="submit">Salvar temporada</button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><CalendarRange /> Temporadas cadastradas</div>
              <div className="card__subtitle">{seasons.length} temporadas</div>
            </div>
          </div>
          <div className="card__body card__body--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Início</th>
                  <th>Termino</th>
                  <th>Ativa</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {seasons.length ? seasons.map((season) => (
                  <tr key={season.id}>
                    <td>{season.name}</td>
                    <td className="mono">{formatDateShort(season.startsAt)}</td>
                    <td className="mono">{formatDateShort(season.endsAt)}</td>
                    <td>{season.isActive ? "Sim" : "Não"}</td>
                    <td>
                      <ConfirmForm
                        action={deleteSeasonAction.bind(null, season.id)}
                        message={`Excluir a temporada ${season.name}?`}
                      >
                        <button className="btn btn--ghost btn--icon" type="submit" aria-label={`Excluir ${season.name}`}>
                          <Trash2 />
                        </button>
                      </ConfirmForm>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="muted">Nenhuma temporada cadastrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {seasons.length ? (
            <details className="card__body">
              <summary className="card__title" style={{ cursor: "pointer", marginBottom: 8 }}>Editar temporadas</summary>
              <div className="stack" style={{ marginTop: 12 }}>
                {seasons.map((season) => (
                  <form key={season.id} className="form-grid" action={updateSeasonAction.bind(null, season.id)} style={{ borderTop: "1px dashed var(--border)", paddingTop: 12 }}>
                    <label className="field">
                      <span className="field__label">Nome</span>
                      <input className="input" name="name" defaultValue={season.name} required />
                    </label>
                    <label className="field">
                      <span className="field__label">Início</span>
                      <input className="input" name="startsAt" type="date" defaultValue={dateInputValue(season.startsAt)} required />
                    </label>
                    <label className="field">
                      <span className="field__label">Termino</span>
                      <input className="input" name="endsAt" type="date" defaultValue={dateInputValue(season.endsAt)} required />
                    </label>
                    <label className="check">
                      <input type="checkbox" name="isActive" defaultChecked={season.isActive} /> Ativa
                    </label>
                    <label className="field" style={{ gridColumn: "1 / -1" }}>
                      <span className="field__label">Observações</span>
                      <input className="input" name="notes" defaultValue={season.notes ?? ""} />
                    </label>
                    <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                      <button className="btn" type="submit">Salvar</button>
                    </div>
                  </form>
                ))}
              </div>
            </details>
          ) : null}
        </section>
      </div>
    </>
  );
}
