import { CalendarClock, CreditCard, PawPrint, Save, UserRound } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { FlashMessage } from "@/components/ui/flash-message";
import { getReservationFormData } from "@/lib/app-data";
import { createReservationAction } from "@/app/(app)/reservas/actions";
import { brl } from "@/lib/money";

export default async function NovaReservaPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const { tutors, pets, serviceTypes } = await getReservationFormData();
  const firstService = serviceTypes[0];
  const firstRule = firstService?.priceRules[0];
  const defaultBase = firstRule?.firstPetCents ?? 8000;

  return (
    <>
      <Topbar
        title="Nova reserva"
        subtitle="Passo 3 de 4 - confirmar detalhes"
        actions={
          <>
            <a className="btn" href="/agenda">Cancelar</a>
            <button className="btn btn--primary" form="reservation-form"><Save /> Salvar reserva</button>
          </>
        }
      />
      {sp.error ? (
        <div className="content stack" style={{ paddingBottom: 0 }}>
          <FlashMessage error={sp.error} />
        </div>
      ) : null}
      <div className="content page-grid">
        <form id="reservation-form" className="stack" action={createReservationAction}>
          <div className="card">
            <div className="card__header">
              <div className="card__title"><UserRound /> Tutor e pet</div>
            </div>
            <div className="card__body form-grid">
              <label className="field">
                <span className="field__label">Tutor</span>
                <select className="select" name="tutorId" required>
                  <option value="">Selecione</option>
                  {tutors.map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Pets</span>
                <select className="select" name="petIds" multiple required style={{ minHeight: 116 }}>
                  {pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name} - {pet.tutor.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <div className="card__title"><PawPrint /> Tipo de servico</div>
            </div>
            <div className="card__body form-grid">
              <label className="field">
                <span className="field__label">Servico</span>
                <select className="select" name="serviceTypeId" required>
                  {serviceTypes.map((serviceType) => (
                    <option key={serviceType.id} value={serviceType.id}>{serviceType.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Retirada</span>
                <select className="select" name="pickupMode" defaultValue="TUTOR_DROPS_OFF">
                  <option value="TUTOR_DROPS_OFF">Tutor entrega em maos</option>
                  <option value="ZENI_PICKUP">Zeni retira na casa do cliente</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Distancia taxi pet km</span>
                <input className="input" name="distanceKm" defaultValue="0" />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <div className="card__title"><CalendarClock /> Periodo</div>
            </div>
            <div className="card__body form-grid">
              <label className="field">
                <span className="field__label">Check-in</span>
                <input className="input" name="startsAt" type="datetime-local" required />
              </label>
              <label className="field">
                <span className="field__label">Check-out</span>
                <input className="input" name="endsAt" type="datetime-local" required />
              </label>
              <label className="field">
                <span className="field__label">Valor base</span>
                <input className="input" name="baseAmountCents" defaultValue={(defaultBase / 100).toFixed(2).replace(".", ",")} />
              </label>
              <label className="field">
                <span className="field__label">Desconto</span>
                <input className="input" name="discountCents" defaultValue="0,00" />
              </label>
              <label className="field">
                <span className="field__label">Adicionais</span>
                <input className="input" name="additionalCents" defaultValue="0,00" />
              </label>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span className="field__label">Observacoes da reserva</span>
                <textarea className="textarea" name="notes" placeholder="Rotina, itens, combinados e cuidados sensiveis" />
              </label>
            </div>
          </div>
        </form>

        <aside className="card">
          <div className="card__header">
            <div className="card__title"><CreditCard /> Resumo</div>
          </div>
          <div className="card__body stack" style={{ gap: 14 }}>
            <div className="row row--between"><span className="muted">Servico</span><strong>{firstService?.name ?? "Hospedagem"}</strong></div>
            <div className="row row--between"><span className="muted">Valor base sugerido</span><span>{brl(defaultBase)}</span></div>
            <div className="row row--between"><span className="muted">Taxi pet</span><span>Calculado ao salvar</span></div>
            <div className="row row--between"><span className="muted">Alta temporada</span><span>Aplicada automaticamente</span></div>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }} className="row row--between">
              <strong>Sinal sugerido</strong><strong>50%</strong>
            </div>
            <label className="check" form="reservation-form">
              <input type="checkbox" name="inviteTutor" form="reservation-form" /> Enviar convite ao tutor
            </label>
          </div>
        </aside>
      </div>
    </>
  );
}
