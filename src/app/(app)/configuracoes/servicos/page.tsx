import { Plus, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { FlashMessage } from "@/components/ui/flash-message";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { getPrisma } from "@/lib/db";
import { brl } from "@/lib/money";
import {
  createPriceRuleAction,
  createServiceTypeAction,
  deletePriceRuleAction,
  deleteServiceTypeAction,
  updatePriceRuleAction,
  updateServiceTypeAction,
} from "./actions";

const KIND_LABELS: Record<string, string> = {
  BOARDING: "Hospedagem",
  DAYCARE: "Creche",
  PET_SITTING: "Pet sitter",
  DOG_WALKER: "Dog walker",
  TAXI_PET: "Taxi pet",
  ADAPTATION: "Adaptação",
  OTHER: "Outro",
};

const PAYMENT_LABELS: Record<string, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CARD: "Cartão",
  TRANSFER: "Transferência",
  OTHER: "Outro",
};

function centsInput(cents?: number | null) {
  if (cents == null || cents === 0) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default async function ServicosPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const services = await getPrisma().serviceType.findMany({
    include: { priceRules: { orderBy: [{ paymentMethod: "asc" }, { label: "asc" }] } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <Topbar
        title="Serviços e preços"
        subtitle="Gerencie tipos de serviço, regras de preço e taxas adicionais"
        actions={<Link className="btn" href="/configuracoes">Voltar</Link>}
      />
      <div className="content stack">
        <FlashMessage error={sp.error} saved={sp.saved} deleted={sp.deleted} />

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><Plus /> Novo tipo de servico</div>
              <div className="card__subtitle">Cadastre uma categoria antes de criar regras de preço</div>
            </div>
          </div>
          <form className="card__body form-grid" action={createServiceTypeAction}>
            <label className="field">
              <span className="field__label">Nome</span>
              <input className="input" name="name" required />
            </label>
            <label className="field">
              <span className="field__label">Tipo</span>
              <select className="select" name="kind" defaultValue="BOARDING">
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="field__label">Descrição</span>
              <input className="input" name="description" />
            </label>
            <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
              <button className="btn btn--primary" type="submit">Salvar tipo</button>
            </div>
          </form>
        </section>

        {services.map((service) => (
          <section className="card" key={service.id}>
            <div className="card__header">
              <div>
                <div className="card__title"><Settings /> {service.name}</div>
                <div className="card__subtitle">
                  {KIND_LABELS[service.kind] ?? service.kind}
                  {service.isActive ? "" : " (inativo)"} - {service.priceRules.length} regras
                </div>
              </div>
              <ConfirmForm
                action={deleteServiceTypeAction.bind(null, service.id)}
                message={`Excluir o servico ${service.name}? Reservas existentes podem bloquear a exclusao.`}
              >
                <button className="btn btn--ghost btn--icon" type="submit" aria-label={`Excluir ${service.name}`} title="Excluir servico">
                  <Trash2 />
                </button>
              </ConfirmForm>
            </div>
            <form className="card__body form-grid" action={updateServiceTypeAction.bind(null, service.id)}>
              <label className="field">
                <span className="field__label">Nome</span>
                <input className="input" name="name" defaultValue={service.name} required />
              </label>
              <label className="field">
                <span className="field__label">Tipo</span>
                <select className="select" name="kind" defaultValue={service.kind}>
                  {Object.entries(KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span className="field__label">Descrição</span>
                <input className="input" name="description" defaultValue={service.description ?? ""} />
              </label>
              <label className="check">
                <input type="checkbox" name="isActive" defaultChecked={service.isActive} /> Ativo
              </label>
              <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                <button className="btn" type="submit">Salvar tipo</button>
              </div>
            </form>

            <div className="card__body card__body--flush">
              <table className="table">
                <thead>
                  <tr>
                    <th>Regra</th>
                    <th>Pagamento</th>
                    <th className="table__num">1° pet</th>
                    <th className="table__num">Adicional</th>
                    <th className="table__num">Alta 1° pet</th>
                    <th className="table__num">Alta adicional</th>
                    <th className="table__num">Taxi base</th>
                    <th className="table__num">Por km</th>
                    <th className="table__num">Higiene</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>
                <tbody>
                  {service.priceRules.length ? service.priceRules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.label}{rule.isActive ? "" : " (inativa)"}</td>
                      <td>{PAYMENT_LABELS[rule.paymentMethod] ?? rule.paymentMethod}</td>
                      <td className="table__num">{brl(rule.firstPetCents)}</td>
                      <td className="table__num">{rule.additionalPetCents ? brl(rule.additionalPetCents) : "-"}</td>
                      <td className="table__num">{rule.highSeasonFirstPetCents ? brl(rule.highSeasonFirstPetCents) : "-"}</td>
                      <td className="table__num">{rule.highSeasonAdditionalCents ? brl(rule.highSeasonAdditionalCents) : "-"}</td>
                      <td className="table__num">{rule.fixedFeeCents ? brl(rule.fixedFeeCents) : "-"}</td>
                      <td className="table__num">{rule.perKmCents ? brl(rule.perKmCents) : "-"}</td>
                      <td className="table__num">{rule.hygieneFeeCents ? brl(rule.hygieneFeeCents) : "-"}</td>
                      <td>
                        <ConfirmForm
                          action={deletePriceRuleAction.bind(null, rule.id)}
                          message={`Excluir a regra ${rule.label}?`}
                        >
                          <button className="btn btn--ghost btn--icon" type="submit" aria-label={`Excluir ${rule.label}`} title="Excluir regra">
                            <Trash2 />
                          </button>
                        </ConfirmForm>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={10} className="muted">Sem regras de preço para este serviço.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <details className="card__body">
              <summary className="card__title" style={{ cursor: "pointer", marginBottom: 8 }}>
                <Plus style={{ display: "inline", verticalAlign: "middle", width: 14 }} /> Nova regra de preço
              </summary>
              <form className="form-grid" action={createPriceRuleAction} style={{ marginTop: 12 }}>
                <input type="hidden" name="serviceTypeId" value={service.id} />
                <label className="field">
                  <span className="field__label">Rotulo</span>
                  <input className="input" name="label" placeholder="Ex.: 1 pet" required />
                </label>
                <label className="field">
                  <span className="field__label">Pagamento</span>
                  <select className="select" name="paymentMethod" defaultValue="PIX">
                    {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field__label">1° pet</span>
                  <input className="input" name="firstPetCents" placeholder="0,00" required />
                </label>
                <label className="field">
                  <span className="field__label">Pet adicional</span>
                  <input className="input" name="additionalPetCents" placeholder="0,00" />
                </label>
                <label className="field">
                  <span className="field__label">Alta temporada (1°)</span>
                  <input className="input" name="highSeasonFirstPetCents" placeholder="0,00" />
                </label>
                <label className="field">
                  <span className="field__label">Alta (adicional)</span>
                  <input className="input" name="highSeasonAdditionalCents" placeholder="0,00" />
                </label>
                <label className="field">
                  <span className="field__label">Taxi pet base</span>
                  <input className="input" name="fixedFeeCents" placeholder="0,00" />
                </label>
                <label className="field">
                  <span className="field__label">Taxi por km</span>
                  <input className="input" name="perKmCents" placeholder="0,00" />
                </label>
                <label className="field">
                  <span className="field__label">Higiene</span>
                  <input className="input" name="hygieneFeeCents" placeholder="0,00" />
                </label>
                <label className="check">
                  <input type="checkbox" name="isActive" defaultChecked /> Ativa
                </label>
                <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                  <button className="btn btn--primary" type="submit">Adicionar regra</button>
                </div>
              </form>
            </details>

            {service.priceRules.length ? (
              <details className="card__body">
                <summary className="card__title" style={{ cursor: "pointer", marginBottom: 8 }}>
                  Editar regras existentes
                </summary>
                <div className="stack" style={{ marginTop: 12, gap: 16 }}>
                  {service.priceRules.map((rule) => (
                    <form key={rule.id} className="form-grid" action={updatePriceRuleAction.bind(null, rule.id)} style={{ borderTop: "1px dashed var(--border)", paddingTop: 12 }}>
                      <label className="field">
                        <span className="field__label">Rotulo</span>
                        <input className="input" name="label" defaultValue={rule.label} required />
                      </label>
                      <label className="field">
                        <span className="field__label">Pagamento</span>
                        <select className="select" name="paymentMethod" defaultValue={rule.paymentMethod}>
                          {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="field__label">1° pet</span>
                        <input className="input" name="firstPetCents" defaultValue={centsInput(rule.firstPetCents)} required />
                      </label>
                      <label className="field">
                        <span className="field__label">Pet adicional</span>
                        <input className="input" name="additionalPetCents" defaultValue={centsInput(rule.additionalPetCents)} />
                      </label>
                      <label className="field">
                        <span className="field__label">Alta (1°)</span>
                        <input className="input" name="highSeasonFirstPetCents" defaultValue={centsInput(rule.highSeasonFirstPetCents)} />
                      </label>
                      <label className="field">
                        <span className="field__label">Alta (adicional)</span>
                        <input className="input" name="highSeasonAdditionalCents" defaultValue={centsInput(rule.highSeasonAdditionalCents)} />
                      </label>
                      <label className="field">
                        <span className="field__label">Taxi base</span>
                        <input className="input" name="fixedFeeCents" defaultValue={centsInput(rule.fixedFeeCents)} />
                      </label>
                      <label className="field">
                        <span className="field__label">Por km</span>
                        <input className="input" name="perKmCents" defaultValue={centsInput(rule.perKmCents)} />
                      </label>
                      <label className="field">
                        <span className="field__label">Higiene</span>
                        <input className="input" name="hygieneFeeCents" defaultValue={centsInput(rule.hygieneFeeCents)} />
                      </label>
                      <label className="check">
                        <input type="checkbox" name="isActive" defaultChecked={rule.isActive} /> Ativa
                      </label>
                      <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                        <button className="btn" type="submit">Salvar regra</button>
                      </div>
                    </form>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        ))}
      </div>
    </>
  );
}
