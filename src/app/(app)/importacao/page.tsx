import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Database,
  Eye,
  FileWarning,
  Filter,
  ListChecks,
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
import { brl } from "@/lib/money";
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
  OPEN: "A revisar",
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

type DisplayField = {
  label: string;
  value: string;
};

type ImportRecordForView = {
  normalizedPayload: unknown;
  rawPayload: unknown;
  detectedType: string;
  confidence: number;
  status: string;
  reviewNotes: string | null;
  batch: { fileName: string; sourceKind: string };
  sourceSheet: string | null;
  sourceRow: number | null;
  sourceBlock: number | null;
};

type ImportRecordView = {
  title: string;
  subtitle: string | null;
  targetLabel: string;
  targetDescription: string;
  facts: DisplayField[];
  allFields: DisplayField[];
  checks: string[];
};

const fieldLabels: Record<string, string> = {
  address: "Endereço",
  amountCents: "Valor",
  birthDate: "Nascimento",
  cardCents: "Cartão",
  category: "Categoria",
  cep: "CEP",
  date: "Data",
  deliveredItems: "Itens entregues",
  details: "Detalhe",
  document: "CPF/RG",
  email: "E-mail",
  fixedFeeCents: "Taxa fixa",
  highSeasonCardCents: "Alta temp. cartão",
  highSeasonPixCents: "Alta temp. PIX",
  hygieneFeeCents: "Higienização",
  kind: "Tipo",
  label: "Rótulo",
  name: "Nome",
  notes: "Observações",
  payment: "Pagamento",
  perKmCents: "Valor por km",
  period: "Período",
  petName: "Pet",
  pets: "Pets",
  phone: "Telefone",
  pixCents: "PIX",
  schedule: "Horário",
  service: "Serviço",
  sheetName: "Aba",
  tutorName: "Tutor",
  values: "Valores",
};

function asPayloadRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isBlankValue(value: unknown) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0 || value.every(isBlankValue);
  return String(value).trim() === "";
}

function truncateText(value: string, maxLength = 120) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function formatPayloadValue(key: string, value: unknown): string {
  if (isBlankValue(value)) return "Não informado";
  if (Array.isArray(value)) {
    return value
      .map((item) => formatPayloadValue(key, item))
      .filter((item) => item !== "Não informado")
      .join(", ") || "Não informado";
  }
  if (typeof value === "number" && key.endsWith("Cents")) return brl(value);
  if (key === "kind" && value === "INCOME") return "Receita";
  if (key === "kind" && value === "EXPENSE") return "Despesa";
  if (typeof value === "object") return truncateText(JSON.stringify(value), 160);
  return truncateText(String(value));
}

function fieldFromPayload(payload: Record<string, unknown>, key: string, label = fieldLabels[key] ?? key): DisplayField | null {
  if (isBlankValue(payload[key])) return null;
  return { label, value: formatPayloadValue(key, payload[key]) };
}

function fieldsFromPayload(payload: Record<string, unknown>, keys: string[]) {
  return keys
    .map((key) => fieldFromPayload(payload, key))
    .filter((field): field is DisplayField => Boolean(field));
}

function fallbackFields(payload: Record<string, unknown>) {
  return Object.entries(payload)
    .map(([key, value]) => fieldFromPayload({ [key]: value }, key))
    .filter((field): field is DisplayField => Boolean(field))
    .slice(0, 10);
}

function textValue(payload: Record<string, unknown>, key: string) {
  if (isBlankValue(payload[key])) return null;
  return formatPayloadValue(key, payload[key]);
}

function firstText(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = textValue(payload, key);
    if (value) return value;
  }
  return null;
}

function isClientCreditPayload(payload: Record<string, unknown>) {
  const period = String(payload.period ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  return period.includes("ficou") && period.includes("credito");
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

function confidenceLabel(confidence: number) {
  const tone = confidenceTone(confidence);
  if (tone === "high") return "Alta";
  if (tone === "medium") return "Média";
  return "Baixa";
}

function statusHelp(status: string) {
  const messages: Record<string, string> = {
    PENDING_REVIEW: "Ainda não entrou no sistema final. Revise os campos principais e aprove quando estiver correto.",
    NEEDS_REVIEW: "Foi marcado como inseguro ou incompleto. Ajuste o JSON normalizado ou rejeite antes de importar.",
    APPROVED: "Já está aprovado. O botão Importar grava este item nas tabelas finais.",
    IMPORTED: "Já foi gravado no sistema final. O histórico mostra qual entidade foi criada.",
    REJECTED: "Foi descartado e não será importado.",
  };
  return messages[status] ?? "Revise o registro antes de decidir.";
}

function fieldsOrFallback(payload: Record<string, unknown>, keys: string[]) {
  const fields = fieldsFromPayload(payload, keys);
  return fields.length ? fields : fallbackFields(payload);
}

function buildImportRecordView(record: ImportRecordForView): ImportRecordView {
  const payload = asPayloadRecord(record.normalizedPayload ?? record.rawPayload);

  switch (record.detectedType) {
    case "CLIENT_FORM": {
      const fields = fieldsOrFallback(payload, [
        "tutorName",
        "pets",
        "document",
        "phone",
        "email",
        "address",
        "service",
        "schedule",
        "values",
        "deliveredItems",
        "notes",
      ]);
      const pets = textValue(payload, "pets");
      return {
        title: firstText(payload, ["tutorName"]) ?? "Ficha de cliente sem tutor",
        subtitle: pets ? `Pets: ${pets}` : "Ficha de tutor e pets",
        targetLabel: "Tutor e pets",
        targetDescription: "Cria a ficha do tutor e cadastra os pets listados no documento.",
        facts: fields.slice(0, 6),
        allFields: fields,
        checks: [
          "Confirmar se o nome do tutor está escrito do jeito certo.",
          "Conferir se cada pet listado pertence mesmo a este tutor.",
          "Validar telefone, endereço e observações antes de aprovar.",
        ],
      };
    }
    case "HISTORICAL_RESERVATION": {
      const creditPayload = isClientCreditPayload(payload);
      const fields = fieldsOrFallback(
        payload,
        creditPayload
          ? ["tutorName", "pets", "period", "amountCents", "payment"]
          : ["tutorName", "pets", "service", "period", "amountCents", "payment"],
      );
      return {
        title: firstText(payload, ["tutorName"]) ?? (creditPayload ? "Crédito sem tutor" : "Reserva histórica sem tutor"),
        subtitle: firstText(payload, creditPayload ? ["period", "pets"] : ["service", "period"]),
        targetLabel: creditPayload ? "Crédito do cliente" : "Reserva histórica",
        targetDescription: creditPayload
          ? "Cria saldo de crédito no perfil do tutor, sem criar reserva nem receita."
          : "Cria uma reserva antiga, o pagamento correspondente e uma entrada financeira.",
        facts: fields.slice(0, 6),
        allFields: fields,
        checks: creditPayload
          ? [
              "Confirmar se o valor realmente ficou de crédito para a próxima visita.",
              "Conferir se o tutor está correto antes de aprovar.",
              "Esse registro não deve entrar como receita até o crédito ser usado.",
            ]
          : [
              "O tutor e os pets precisam estar corretos para evitar duplicidade.",
              "O período deve estar legível, por exemplo 12 a 16/06/2025.",
              "O serviço precisa existir em Serviços e preços.",
            ],
      };
    }
    case "DAYCARE_RESERVATION": {
      const fields = fieldsOrFallback(payload, ["tutorName", "petName", "date", "schedule", "amountCents", "payment"]);
      return {
        title: firstText(payload, ["petName", "tutorName"]) ?? "Creche sem identificação",
        subtitle: firstText(payload, ["date", "schedule"]),
        targetLabel: "Reserva de creche",
        targetDescription: "Cria uma reserva de creche com pagamento e lançamento financeiro.",
        facts: fields.slice(0, 6),
        allFields: fields,
        checks: [
          "Conferir data e horário, principalmente quando a confiança estiver média ou baixa.",
          "Validar o nome do tutor e do pet.",
          "Conferir valor e forma de pagamento.",
        ],
      };
    }
    case "SERVICE_PRICE": {
      const fields = fieldsOrFallback(payload, [
        "service",
        "details",
        "pixCents",
        "cardCents",
        "highSeasonPixCents",
        "highSeasonCardCents",
      ]);
      return {
        title: firstText(payload, ["service"]) ?? "Preço sem serviço",
        subtitle: firstText(payload, ["details"]),
        targetLabel: "Tipo de serviço e regra de preço",
        targetDescription: "Cria ou atualiza o serviço e suas regras de preço para PIX e cartão.",
        facts: fields.slice(0, 6),
        allFields: fields,
        checks: [
          "Conferir se o nome do serviço deve virar uma categoria nova.",
          "Validar valores de PIX, cartão e alta temporada.",
          "Ajustar o detalhe quando ele representar pacote, diária ou primeiro pet.",
        ],
      };
    }
    case "TAXI_RULE": {
      const fields = fieldsOrFallback(payload, ["name", "fixedFeeCents", "perKmCents", "hygieneFeeCents"]);
      return {
        title: firstText(payload, ["name"]) ?? "Regra de taxi pet",
        subtitle: "Taxas de deslocamento",
        targetLabel: "Serviço Taxi pet",
        targetDescription: "Cria ou atualiza a regra de taxi pet com taxa fixa, km e higienização.",
        facts: fields.slice(0, 4),
        allFields: fields,
        checks: [
          "Conferir se a taxa fixa e o valor por km estão preenchidos.",
          "Validar se existe adicional de higienização.",
          "Aprovar apenas a regra que deve valer na operação.",
        ],
      };
    }
    case "FINANCIAL_ENTRY": {
      const fields = fieldsOrFallback(payload, ["kind", "category", "date", "amountCents"]);
      return {
        title: firstText(payload, ["category"]) ?? "Lançamento financeiro",
        subtitle: firstText(payload, ["date"]),
        targetLabel: "Entrada financeira",
        targetDescription: "Cria um lançamento financeiro importado a partir da planilha.",
        facts: fields.slice(0, 4),
        allFields: fields,
        checks: [
          "Confirmar se o tipo é Receita ou Despesa antes de importar.",
          "Conferir categoria, data e valor do lançamento.",
          "Rejeitar totais ou linhas de apoio que não sejam movimentações reais.",
        ],
      };
    }
    case "FINANCIAL_SUMMARY": {
      const fields = fieldsOrFallback(payload, ["label", "sheetName", "amountCents"]);
      return {
        title: firstText(payload, ["label"]) ?? "Fechamento financeiro",
        subtitle: firstText(payload, ["sheetName"]),
        targetLabel: "Resumo mensal",
        targetDescription: "Cria ou atualiza o fechamento mensal com o total da aba.",
        facts: fields.slice(0, 4),
        allFields: fields,
        checks: [
          "Conferir se a aba representa um mês válido.",
          "Validar se a linha é realmente o total do período.",
          "Rejeitar caso seja subtotal duplicado.",
        ],
      };
    }
    default: {
      const fields = fallbackFields(payload);
      return {
        title: firstText(payload, ["name", "label", "tutorName", "service"]) ?? "Registro importado",
        subtitle: null,
        targetLabel: typeLabels[record.detectedType] ?? record.detectedType,
        targetDescription: "Tipo ainda sem leitura específica. Confira os campos antes de aprovar.",
        facts: fields.slice(0, 5),
        allFields: fields,
        checks: ["Conferir payload normalizado.", "Aprovar somente se estiver claro o destino do dado."],
      };
    }
  }
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  const tone = confidenceTone(confidence);
  return (
    <div className={`confidence-meter confidence-meter--${tone}`}>
      <div className="confidence-meter__top">
        <strong>{percent}%</strong>
        <span>{confidenceLabel(confidence)}</span>
      </div>
      <div className="confidence-meter__track" aria-hidden="true">
        <span className="confidence-meter__bar" style={{ width: `${Math.max(0, Math.min(percent, 100))}%` }} />
      </div>
    </div>
  );
}

function FieldList({ fields }: { fields: DisplayField[] }) {
  if (!fields.length) return <p className="muted import-empty">Nenhum campo legivel encontrado.</p>;

  return (
    <div className="import-field-grid">
      {fields.map((field) => (
        <div className="import-field" key={`${field.label}-${field.value}`}>
          <span className="import-field__label">{field.label}</span>
          <strong className="import-field__value">{field.value}</strong>
        </div>
      ))}
    </div>
  );
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
  const firstRecordNumber = review.totalFiltered
    ? (review.filters.page - 1) * review.pageSize + 1
    : 0;
  const lastRecordNumber = Math.min(review.filters.page * review.pageSize, review.totalFiltered);

  return (
    <>
      <Topbar
        title="Revisão de importação"
        subtitle="Aprovar, corrigir e mesclar dados reais antes da importação final"
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
          <MetricCard label="Pendentes" value={String(review.metrics.pending)} hint="aguardando decisão" icon={FileWarning} />
          <MetricCard label="Aprovados" value={String(review.metrics.approved)} hint="prontos para lote final" icon={CheckCircle2} positive />
          <MetricCard label="Revisão" value={String(review.metrics.needsReview)} hint="precisam de ajuste" icon={Pencil} />
        </div>

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><Merge /> Duplicidades</div>
              <div className="card__subtitle">
                {dedupe.tutorCandidates.length} grupos de tutores e {dedupe.petCandidates.length} grupos de pets aguardando decisão
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
                Nenhum candidato aberto. Use os botões acima para detectar duplicidades a partir dos cadastros atuais.
              </p>
            )}
            {dedupe.auditLogs.length ? (
              <div className="stack" style={{ gap: 8 }}>
                <div className="field__label">Últimas mesclagens</div>
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
              <div className="card__subtitle">Cada arquivo fica isolado com status próprio</div>
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
                  <th>Ações</th>
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
                <option value="OPEN">A revisar</option>
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
              <div className="card__subtitle">
                Página {review.filters.page} de {review.totalPages} - registros {firstRecordNumber} a {lastRecordNumber} de {review.totalFiltered}
              </div>
            </div>
            <div className="row">
              <Link className="btn btn--sm" href={pageHref(review.filters, Math.max(review.filters.page - 1, 1))}>Anterior</Link>
              <Link className="btn btn--sm" href={pageHref(review.filters, Math.min(review.filters.page + 1, review.totalPages))}>Próxima</Link>
            </div>
          </div>
          <div className="card__body card__body--flush">
            <table className="table review-table">
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Confiança</th>
                  <th>Registro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {review.records.length ? review.records.map((record, index) => {
                  const view = buildImportRecordView(record);
                  const recordNumber = (review.filters.page - 1) * review.pageSize + index + 1;

                  return (
                    <Fragment key={record.id}>
                      <tr>
                        <td>
                          <strong>{record.batch.fileName}</strong>
                          <div className="subtle" style={{ fontSize: 11 }}>{sourceLabel(record)}</div>
                          <div className="subtle" style={{ fontSize: 11 }}>{record.batch.sourceKind}</div>
                        </td>
                        <td>{typeLabels[record.detectedType] ?? record.detectedType}</td>
                        <td><StatusBadge status={record.status} /></td>
                        <td><ConfidenceMeter confidence={record.confidence} /></td>
                        <td className="review-record-cell">
                          <div className="import-record-summary">
                            <div className="import-record-summary__top">
                              <span className="record-position">Registro {recordNumber} de {review.totalFiltered}</span>
                              <span className="record-kind">{typeLabels[record.detectedType] ?? record.detectedType}</span>
                            </div>
                            <div>
                              <strong className="import-record-title">{view.title}</strong>
                              {view.subtitle ? <div className="import-record-subtitle">{view.subtitle}</div> : null}
                            </div>
                            <div className="import-target">
                              <ArrowRight />
                              <div>
                                <strong>{view.targetLabel}</strong>
                                <span>{view.targetDescription}</span>
                              </div>
                            </div>
                            <FieldList fields={view.facts.slice(0, 4)} />
                          </div>
                        </td>
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
                            <summary><Eye /> Entender este registro e corrigir</summary>
                            <div className="review-details__body">
                              <div className="import-explain-grid">
                                <div className="import-explain-panel import-explain-panel--wide">
                                  <div className="import-explain-heading"><Eye /> Leitura do registro</div>
                                  <p>
                                    Este item veio de <strong>{sourceLabel(record)}</strong> no lote <strong>{record.batch.fileName}</strong>.
                                    {" "}{statusHelp(record.status)}
                                  </p>
                                  {record.reviewNotes ? (
                                    <div className="import-note">
                                      <strong>Nota atual</strong>
                                      <span>{record.reviewNotes}</span>
                                    </div>
                                  ) : null}
                                </div>
                                <div className="import-explain-panel">
                                  <div className="import-explain-heading"><ArrowRight /> Vai virar</div>
                                  <strong className="import-explain-target">{view.targetLabel}</strong>
                                  <p>{view.targetDescription}</p>
                                </div>
                                <div className="import-explain-panel import-explain-panel--wide">
                                  <div className="import-explain-heading"><ClipboardCheck /> Campos principais</div>
                                  <FieldList fields={view.allFields} />
                                </div>
                                <div className="import-explain-panel">
                                  <div className="import-explain-heading"><ListChecks /> O que conferir</div>
                                  <ul className="import-checklist">
                                    {view.checks.map((check) => (
                                      <li key={check}><span aria-hidden="true" />{check}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              <form className="review-editor" action={updateImportRecordPayloadAction.bind(null, record.id)}>
                                <input type="hidden" name="nextStatus" value="APPROVED" />
                                <label className="field">
                                  <span className="field__label">JSON normalizado editável</span>
                                  <textarea className="textarea mono review-textarea" name="normalizedPayload" defaultValue={jsonValue(record.normalizedPayload ?? record.rawPayload)} />
                                </label>
                                <label className="field">
                                  <span className="field__label">Nota da correção</span>
                                  <input className="input" name="reviewNotes" defaultValue={record.reviewNotes ?? ""} placeholder="O que foi corrigido ou validado" />
                                </label>
                                <div className="row">
                                  <button className="btn btn--primary" type="submit"><Pencil /> Salvar correção</button>
                                  <button className="btn" formAction={updateImportRecordStatusAction.bind(null, record.id, "NEEDS_REVIEW")} type="submit">Marcar revisão</button>
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
                                  <span className="field__label">JSON bruto original</span>
                                  <textarea className="textarea mono review-textarea" readOnly value={jsonValue(record.rawPayload)} />
                                </label>
                                <div className="stack" style={{ gap: 8 }}>
                                  <div className="field__label">Histórico de resoluções</div>
                                  {record.resolutions.length ? record.resolutions.map((resolution) => (
                                    <div className="review-resolution-item" key={resolution.id}>
                                      <strong>{resolution.action}</strong>
                                      <span className="subtle">{resolution.notes || "Sem nota"}</span>
                                    </div>
                                  )) : <p className="muted" style={{ margin: 0, fontSize: 13 }}>Nenhuma resolução registrada.</p>}
                                </div>
                              </div>
                            </div>
                          </details>
                        </td>
                      </tr>
                    </Fragment>
                  );
                }) : (
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
