import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Database,
  FileWarning,
  Filter,
  Merge,
  Pencil,
  PlayCircle,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { Topbar } from "@/components/layout/topbar";
import { MetricCard } from "@/components/ui/metric-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FlashMessage } from "@/components/ui/flash-message";
import { getImportReviewData, type ImportReviewParams } from "@/lib/app-data";
import { getDedupeReviewData, type DedupeCandidateView } from "@/lib/dedupe";
import {
  createMergeResolutionAction,
  detectDuplicatePetsAction,
  detectDuplicateTutorsAction,
  importApprovedBatchAction,
  importApprovedRecordAction,
  mergePetsAction,
  mergeTutorsAction,
  updateImportBatchStatusAction,
  updateImportRecordPayloadAction,
  updateImportRecordStatusAction,
} from "./actions";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const statusLabels: Record<string, string> = {
  ALL: "Todos",
  PENDING_REVIEW: "Pendente",
  NEEDS_REVIEW: "Revisao",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  IMPORTED: "Importado",
};

const typeLabels: Record<string, string> = {
  ALL: "Todos",
  SERVICE_PRICE: "Preco",
  TAXI_RULE: "Taxi",
  HISTORICAL_RESERVATION: "Reserva historica",
  DAYCARE_RESERVATION: "Creche",
  FINANCIAL_ENTRY: "Financeiro",
  FINANCIAL_SUMMARY: "Fechamento",
  CLIENT_FORM: "Ficha cliente",
  UNKNOWN: "Desconhecido",
};

function firstParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function jsonValue(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function payloadPreview(value: unknown) {
  const payload = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const priority = [
    "tutorName",
    "petName",
    "pets",
    "service",
    "period",
    "date",
    "schedule",
    "amountCents",
    "payment",
    "label",
    "name",
    "details",
  ];

  const parts = priority
    .filter((key) => payload[key] != null && String(payload[key]).trim())
    .map((key) => `${key}: ${Array.isArray(payload[key]) ? (payload[key] as unknown[]).join(", ") : payload[key]}`);

  return parts.slice(0, 4).join(" | ") || JSON.stringify(value ?? {}).slice(0, 140);
}

function sourceLabel(record: {
  sourceSheet: string | null;
  sourceRow: number | null;
  sourceBlock: number | null;
}) {
  if (record.sourceSheet) {
    return `${record.sourceSheet}${record.sourceRow ? `, linha ${record.sourceRow}` : ""}`;
  }
  return record.sourceBlock ? `Bloco DOCX ${record.sourceBlock}` : "Origem sem detalhe";
}

function pageHref(filters: Omit<ImportReviewParams, "page"> & { page?: string | number }, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page: String(page) })) {
    if (value && value !== "ALL" && !(key === "page" && value === "1")) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/importacao?${query}` : "/importacao";
}

function DedupeCandidateForm({
  candidate,
  kind,
}: {
  candidate: DedupeCandidateView;
  kind: "tutor" | "pet";
}) {
  const canonicalDefault = candidate.summary.items[0]?.id ?? candidate.candidateIds[0] ?? "";
  const action = kind === "tutor"
    ? mergeTutorsAction.bind(null, candidate.id)
    : mergePetsAction.bind(null, candidate.id);

  return (
    <form className="review-resolution" action={action}>
      <div className="row row--between" style={{ alignItems: "flex-start" }}>
        <div>
          <div className="card__title">
            <Merge /> {candidate.summary.title}
          </div>
          <div className="card__subtitle">
            {candidate.summary.reason} Confianca {Math.round(candidate.confidence * 100)}%.
          </div>
        </div>
        <button className="btn btn--sm btn--primary" type="submit">Mesclar selecionados</button>
      </div>
      <div className="card__body card__body--flush" style={{ marginTop: 10 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Canonico</th>
              <th>Mesclar</th>
              <th>Registro</th>
              <th>Evidencias</th>
            </tr>
          </thead>
          <tbody>
            {candidate.summary.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    aria-label={`Manter ${item.name} como canonico`}
                    defaultChecked={item.id === canonicalDefault}
                    name="canonicalId"
                    type="radio"
                    value={item.id}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Mesclar ${item.name}`}
                    defaultChecked={item.id !== canonicalDefault}
                    name="mergeIds"
                    type="checkbox"
                    value={item.id}
                  />
                </td>
                <td>
                  <strong>{item.name}</strong>
                  {item.subtitle ? <div className="subtle" style={{ fontSize: 11 }}>{item.subtitle}</div> : null}
                </td>
                <td className="muted">{item.evidence.join(" | ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}

export default async function ImportacaoPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const [review, dedupe] = await Promise.all([
    getImportReviewData({
      batchId: firstParam(params, "batchId"),
      status: firstParam(params, "status"),
      type: firstParam(params, "type"),
      q: firstParam(params, "q"),
      page: firstParam(params, "page"),
    }),
    getDedupeReviewData(),
  ]);
  const error = firstParam(params, "error");

  return (
    <>
      <Topbar
        title="Revisao de importacao"
        subtitle="Aprovar, corrigir e mesclar dados reais antes da importacao final"
        actions={<a className="btn btn--primary" href="#registros"><ClipboardList /> Revisar registros</a>}
      />
      <div className="content stack" id="registros">
        <FlashMessage error={error} saved={firstParam(params, "saved")} />
        {firstParam(params, "imported") ? (
          <div className="alert alert--success">
            {firstParam(params, "imported")} registros importados, {firstParam(params, "failed") ?? "0"} falhas.
          </div>
        ) : null}

        <div className="grid-4">
          <MetricCard label="Registros no staging" value={String(review.metrics.total)} hint="fontes oficiais" icon={Database} />
          <MetricCard label="Pendentes" value={String(review.metrics.pending)} hint="aguardando decisao" icon={FileWarning} />
          <MetricCard label="Aprovados" value={String(review.metrics.approved)} hint="prontos para lote final" icon={CheckCircle2} positive />
          <MetricCard label="Revisao" value={String(review.metrics.needsReview)} hint="precisam de ajuste" icon={Pencil} />
        </div>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><Merge /> Duplicidades</div>
              <div className="card__subtitle">
                {dedupe.tutorCandidates.length} grupos de tutores e {dedupe.petCandidates.length} grupos de pets aguardando decisao
              </div>
            </div>
            <div className="row">
              <form action={detectDuplicateTutorsAction}>
                <button className="btn btn--sm" type="submit">Detectar tutores</button>
              </form>
              <form action={detectDuplicatePetsAction}>
                <button className="btn btn--sm" type="submit">Detectar pets</button>
              </form>
            </div>
          </div>
          <div className="card__body stack" style={{ gap: 12 }}>
            {dedupe.tutorCandidates.length || dedupe.petCandidates.length ? (
              <>
                {dedupe.tutorCandidates.map((candidate) => (
                  <DedupeCandidateForm candidate={candidate} kind="tutor" key={candidate.id} />
                ))}
                {dedupe.petCandidates.map((candidate) => (
                  <DedupeCandidateForm candidate={candidate} kind="pet" key={candidate.id} />
                ))}
              </>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                Nenhum candidato aberto. Use os botoes acima para detectar duplicidades a partir dos cadastros atuais.
              </p>
            )}
            {dedupe.auditLogs.length ? (
              <div className="stack" style={{ gap: 8 }}>
                <div className="field__label">Ultimas mesclagens</div>
                {dedupe.auditLogs.map((log) => (
                  <div className="review-resolution-item" key={log.id}>
                    <strong>{log.type}</strong>
                    <span className="subtle">
                      {log.mergedIds.length} registros mesclados em {log.canonicalId.slice(0, 8)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><Database /> Lotes</div>
              <div className="card__subtitle">Cada arquivo fica isolado com status proprio</div>
            </div>
          </div>
          <div className="card__body card__body--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Arquivo</th>
                  <th>Origem</th>
                  <th>Status</th>
                  <th>Registros</th>
                  <th>Resumo</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {review.batches.length ? review.batches.map((batch) => (
                  <tr key={batch.id}>
                    <td><strong>{batch.fileName}</strong></td>
                    <td>{batch.sourceKind}</td>
                    <td><StatusBadge status={batch.status} /></td>
                    <td className="mono">{batch.totalRecords}</td>
                    <td className="muted">
                      {Object.entries(batch.statusCounts)
                        .map(([status, count]) => `${statusLabels[status] ?? status}: ${count}`)
                        .join(" | ")}
                    </td>
                    <td>
                      <div className="row">
                        <form action={updateImportBatchStatusAction.bind(null, batch.id, "REVIEWING")}>
                          <button className="btn btn--sm" type="submit">Revisar</button>
                        </form>
                        <form action={updateImportBatchStatusAction.bind(null, batch.id, "APPROVED")}>
                          <button className="btn btn--sm" type="submit">Aprovar lote</button>
                        </form>
                        <form action={importApprovedBatchAction.bind(null, batch.id)}>
                          <button className="btn btn--sm btn--primary" type="submit"><PlayCircle /> Importar aprovados</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="muted">
                      Nenhum lote carregado. Rode <span className="mono">npm.cmd run db:setup</span>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><Filter /> Filtros</div>
              <div className="card__subtitle">Mostrando {review.totalFiltered} de {review.metrics.total} registros</div>
            </div>
            <Link className="btn" href="/importacao">Limpar</Link>
          </div>
          <form className="card__body review-filters" method="get" action="/importacao">
            <label className="field">
              <span className="field__label">Lote</span>
              <select className="select" name="batchId" defaultValue={review.filters.batchId}>
                <option value="ALL">Todos</option>
                {review.batches.map((batch) => (
                  <option value={batch.id} key={batch.id}>{batch.fileName}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Status</span>
              <select className="select" name="status" defaultValue={review.filters.status}>
                <option value="ALL">Todos</option>
                {review.statusOptions.map((status) => (
                  <option value={status} key={status}>{statusLabels[status]}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Tipo</span>
              <select className="select" name="type" defaultValue={review.filters.type}>
                <option value="ALL">Todos</option>
                {review.typeOptions.map((type) => (
                  <option value={type} key={type}>{typeLabels[type]}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Busca</span>
              <div className="search review-search">
                <Search />
                <input className="input input--with-icon" name="q" defaultValue={review.filters.q} placeholder="Tutor, pet, origem ou valor" />
              </div>
            </label>
            <div className="row" style={{ alignSelf: "end" }}>
              <button className="btn btn--primary" type="submit">Aplicar filtros</button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><ClipboardCheck /> Registros</div>
              <div className="card__subtitle">Pagina {review.filters.page} de {review.totalPages}</div>
            </div>
            <div className="row">
              <Link className="btn btn--sm" href={pageHref(review.filters, Math.max(review.filters.page - 1, 1))}>Anterior</Link>
              <Link className="btn btn--sm" href={pageHref(review.filters, Math.min(review.filters.page + 1, review.totalPages))}>Proxima</Link>
            </div>
          </div>
          <div className="card__body card__body--flush">
            <table className="table review-table">
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Confianca</th>
                  <th>Resumo</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {review.records.length ? review.records.map((record) => (
                  <Fragment key={record.id}>
                    <tr>
                      <td>
                        <strong>{record.batch.fileName}</strong>
                        <div className="subtle" style={{ fontSize: 11 }}>{sourceLabel(record)}</div>
                      </td>
                      <td>{typeLabels[record.detectedType] ?? record.detectedType}</td>
                      <td><StatusBadge status={record.status} /></td>
                      <td className="mono">{Math.round(record.confidence * 100)}%</td>
                      <td className="review-summary">{payloadPreview(record.normalizedPayload ?? record.rawPayload)}</td>
                      <td>
                        <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
                          <form action={updateImportRecordStatusAction.bind(null, record.id, "APPROVED")}>
                            <button className="btn btn--sm" type="submit"><CheckCircle2 /> Aprovar</button>
                          </form>
                          <form action={updateImportRecordStatusAction.bind(null, record.id, "REJECTED")}>
                            <button className="btn btn--sm" type="submit"><XCircle /> Rejeitar</button>
                          </form>
                          {record.status === "APPROVED" ? (
                            <form action={importApprovedRecordAction.bind(null, record.id)}>
                              <button className="btn btn--sm btn--primary" type="submit"><PlayCircle /> Importar</button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    <tr className="review-row-details">
                      <td colSpan={6}>
                        <details className="review-details">
                          <summary>Abrir correcao, mesclagem e payload</summary>
                          <div className="review-details__body">
                            <form className="review-editor" action={updateImportRecordPayloadAction.bind(null, record.id)}>
                              <input type="hidden" name="nextStatus" value="APPROVED" />
                              <label className="field">
                                <span className="field__label">Payload normalizado editavel</span>
                                <textarea className="textarea mono review-textarea" name="normalizedPayload" defaultValue={jsonValue(record.normalizedPayload ?? record.rawPayload)} />
                              </label>
                              <label className="field">
                                <span className="field__label">Nota da correcao</span>
                                <input className="input" name="reviewNotes" defaultValue={record.reviewNotes ?? ""} placeholder="O que foi corrigido ou validado" />
                              </label>
                              <div className="row">
                                <button className="btn btn--primary" type="submit"><Pencil /> Salvar correcao</button>
                                <button className="btn" formAction={updateImportRecordStatusAction.bind(null, record.id, "NEEDS_REVIEW")} type="submit">Marcar revisao</button>
                              </div>
                            </form>

                            <div className="review-resolution-grid">
                              <form className="stack review-resolution" action={createMergeResolutionAction.bind(null, record.id, "MERGE_TUTOR")}>
                                <div className="card__title"><Merge /> Mesclar tutor</div>
                                <label className="field">
                                  <span className="field__label">Nome correto do tutor</span>
                                  <input className="input" name="canonicalName" placeholder="Ex.: Francesco Tripodi" />
                                </label>
                                <label className="field">
                                  <span className="field__label">Aliases separados por |</span>
                                  <input className="input" name="aliases" placeholder="Nome A | Nome B" />
                                </label>
                                <label className="field">
                                  <span className="field__label">Nota</span>
                                  <input className="input" name="reviewNotes" placeholder="Validado com Fernanda" />
                                </label>
                                <button className="btn" type="submit">Registrar mesclagem</button>
                              </form>

                              <form className="stack review-resolution" action={createMergeResolutionAction.bind(null, record.id, "MERGE_PET")}>
                                <div className="card__title"><Merge /> Mesclar pet</div>
                                <label className="field">
                                  <span className="field__label">Nome correto do pet</span>
                                  <input className="input" name="canonicalName" placeholder="Ex.: Carlota" />
                                </label>
                                <label className="field">
                                  <span className="field__label">Aliases separados por |</span>
                                  <input className="input" name="aliases" placeholder="Pet A | Pet B" />
                                </label>
                                <label className="field">
                                  <span className="field__label">Nota</span>
                                  <input className="input" name="reviewNotes" placeholder="Mesmo pet validado" />
                                </label>
                                <button className="btn" type="submit">Registrar mesclagem</button>
                              </form>
                            </div>

                            <div className="payload-grid">
                              <label className="field">
                                <span className="field__label">Payload bruto</span>
                                <textarea className="textarea mono review-textarea" readOnly value={jsonValue(record.rawPayload)} />
                              </label>
                              <div className="stack" style={{ gap: 8 }}>
                                <div className="field__label">Historico de resolucoes</div>
                                {record.resolutions.length ? record.resolutions.map((resolution) => (
                                  <div className="review-resolution-item" key={resolution.id}>
                                    <strong>{resolution.action}</strong>
                                    <span className="subtle">{resolution.notes || "Sem nota"}</span>
                                  </div>
                                )) : <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nenhuma resolucao registrada.</p>}
                              </div>
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  </Fragment>
                )) : (
                  <tr>
                    <td colSpan={6} className="muted">Nenhum registro encontrado para os filtros atuais.</td>
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
