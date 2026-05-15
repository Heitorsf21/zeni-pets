import { DollarSign, Plus, Trash2 } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { FlashMessage } from "@/components/ui/flash-message";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { getPrisma } from "@/lib/db";
import { brl } from "@/lib/money";
import { contrastingTextColor } from "@/lib/colors";
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

export default async function ValoresPage({
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
        title="Valores"
        subtitle="Tipos de serviço e tabelas de preço"
      />
      <div className="content stack">
        <FlashMessage error={sp.error} saved={sp.saved} deleted={sp.deleted} />

        <section className="card">
          <div className="card__header">
            <div>
              <div className="card__title"><Plus /> Novo tipo de serviço</div>
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
            <label className="field">
              <span className="field__label">Cor na agenda</span>
              <input className="input" type="color" name="color" defaultValue="#1f6b6f" style={{ minHeight: 38, padding: 4 }} />
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

        {services.map((service) => {
          const serviceColor = service.color ?? "#1f6b6f";
          return (
          <section className="card" key={service.id}>
            <div className="card__header">
              <div>
                <div className="card__title">
                  <DollarSign /> {service.name}
                  <span
                    aria-label={`Cor na agenda: ${serviceColor}`}
                    title={`Cor na agenda: ${serviceColor}`}
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "var(--r-sm)",
                      backgroundColor: serviceColor,
                      color: contrastingTextColor(serviceColor),
                      fontSize: 10,
                      fontWeight: 600,
                      marginLeft: 8,
                    }}
                  >
                    {service.name}
                  </span>
                </div>
                <div className="card__subtitle">
                  {KIND_LABELS[service.kind] ?? service.kind}
                  {service.isActive ? "" : " (inativo)"} · {service.priceRules.length} {service.priceRules.length === 1 ? "regra" : "regras"}
                </div>
              </div>
              <ConfirmForm
                action={deleteServiceTypeAction.bind(null, service.id)}
                message={`Excluir o serviço ${service.name}? Reservas existentes podem bloquear a exclusão.`}
              >
                <button className="btn btn--ghost btn--icon" type="submit" aria-label={`Excluir ${service.name}`} title="Excluir serviço">
                  <Trash2 />
                </button>
              </ConfirmForm>
            </div>

            <details className="card__body">
              <summary style={{ cursor: "pointer", fontWeight: 600, marginBottom: 8 }}>
                Editar dados do serviço
              </summary>
              <form className="form-grid" action={updateServiceTypeAction.bind(null, service.id)} style={{ marginTop: 12 }}>
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
                <label className="field">
                  <span className="field__label">Cor na agenda</span>
                  <input className="input" type="color" name="color" defaultValue={serviceColor} style={{ minHeight: 38, padding: 4 }} />
                </label>
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span className="field__label">Descrição</span>
                  <input className="input" name="description" defaultValue={service.description ?? ""} />
                </label>
                <label className="check">
                  <input type="checkbox" name="isActive" defaultChecked={service.isActive} /> Ativo
                </label>
                <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                  <button className="btn" type="submit">Salvar serviço</button>
                </div>
              </form>
            </details>

            <div className="card__body stack" style={{ gap: 14 }}>
              <div className="field__label">Regras de preço</div>

              {service.priceRules.length ? service.priceRules.map((rule) => (
                <details key={rule.id} className="card" style={{ borderRadius: "var(--r-md)" }}>
                  <summary className="card__body row" style={{ cursor: "pointer", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div className="stack" style={{ gap: 2 }}>
                      <strong>
                        {rule.label}
                        {rule.isActive ? "" : <span className="subtle"> · inativa</span>}
                      </strong>
                      <span className="subtle" style={{ fontSize: 12 }}>
                        {PAYMENT_LABELS[rule.paymentMethod] ?? rule.paymentMethod} · 1° pet {brl(rule.firstPetCents)}
                        {rule.additionalPetCents ? ` + adicional ${brl(rule.additionalPetCents)}` : ""}
                      </span>
                    </div>
                    <ConfirmForm
                      action={deletePriceRuleAction.bind(null, rule.id)}
                      message={`Excluir a regra ${rule.label}?`}
                    >
                      <button className="btn btn--ghost btn--icon" type="submit" aria-label={`Excluir ${rule.label}`} title="Excluir regra">
                        <Trash2 />
                      </button>
                    </ConfirmForm>
                  </summary>
                  <form className="card__body form-grid" action={updatePriceRuleAction.bind(null, rule.id)}>
                    <label className="field">
                      <span className="field__label">Rótulo</span>
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
                    <label className="check">
                      <input type="checkbox" name="isActive" defaultChecked={rule.isActive} /> Ativa
                    </label>
                    <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                      <button className="btn btn--primary" type="submit">Salvar regra</button>
                    </div>
                  </form>
                </details>
              )) : (
                <p className="muted" style={{ margin: 0 }}>Sem regras de preço cadastradas para este serviço.</p>
              )}

              <details>
                <summary className="btn" style={{ cursor: "pointer", display: "inline-flex" }}>
                  <Plus style={{ width: 14 }} /> Adicionar nova regra
                </summary>
                <form className="form-grid" action={createPriceRuleAction} style={{ marginTop: 12 }}>
                  <input type="hidden" name="serviceTypeId" value={service.id} />
                  <label className="field">
                    <span className="field__label">Rótulo</span>
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
                    <span className="field__label">Alta (1°)</span>
                    <input className="input" name="highSeasonFirstPetCents" placeholder="0,00" />
                  </label>
                  <label className="field">
                    <span className="field__label">Alta (adicional)</span>
                    <input className="input" name="highSeasonAdditionalCents" placeholder="0,00" />
                  </label>
                  <label className="check">
                    <input type="checkbox" name="isActive" defaultChecked /> Ativa
                  </label>
                  <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
                    <button className="btn btn--primary" type="submit">Adicionar regra</button>
                  </div>
                </form>
              </details>
            </div>
          </section>
          );
        })}
      </div>
    </>
  );
}
