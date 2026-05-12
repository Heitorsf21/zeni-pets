import { CalendarClock, CreditCard, PawPrint, Save, UserRound } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { FlashMessage } from "@/components/ui/flash-message";
import { getReservationFormData } from "@/lib/app-data";
import { createReservationAction } from "@/app/(app)/reservas/actions";
import { toReservationSeasonOptions, toReservationServiceOptions } from "@/lib/reservation-form-options";
import { ReservationPetFields } from "@/app/(app)/reservas/reservation-pet-fields";
import { ReservationPricingPreview } from "@/app/(app)/reservas/reservation-pricing-preview";
import { ReservationTaskFields } from "@/app/(app)/reservas/reservation-task-fields";
import { ServicePriceRuleFields } from "@/app/(app)/reservas/service-price-rule-fields";

export default async function NovaReservaPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const { tutors, pets, serviceTypes, settings, seasonPeriods } = await getReservationFormData();
  const serviceOptions = toReservationServiceOptions(serviceTypes);
  const seasonOptions = toReservationSeasonOptions(seasonPeriods);

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
              <ReservationPetFields
                tutors={tutors.map((tutor) => ({ id: tutor.id, name: tutor.name }))}
                pets={pets.map((pet) => ({ id: pet.id, name: pet.name, tutor: { id: pet.tutor.id, name: pet.tutor.name } }))}
              />
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <div className="card__title"><PawPrint /> Tipo de servico</div>
            </div>
            <div className="card__body form-grid">
              <ServicePriceRuleFields serviceTypes={serviceOptions} />
              <label className="field">
                <span className="field__label">Retirada</span>
                <select className="select" name="pickupMode" defaultValue="TUTOR_DROPS_OFF">
                  <option value="TUTOR_DROPS_OFF">Tutor entrega em maos</option>
                  <option value="ZENI_PICKUP">Zeni retira na casa do cliente</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Distância taxi pet km</span>
                <input className="input" name="distanceKm" defaultValue="0" />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <div className="card__title"><CalendarClock /> Período</div>
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
                <span className="field__label">Valor base manual</span>
                <input className="input" name="baseAmountCents" placeholder="automatico" />
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
                <span className="field__label">Observações da reserva</span>
                <textarea className="textarea" name="notes" placeholder="Rotina, itens, combinados e cuidados sensiveis" />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <div className="card__title">Tarefa da reserva</div>
            </div>
            <div className="card__body form-grid">
              <ReservationTaskFields
                formId="reservation-form"
                pets={pets.map((pet) => ({ id: pet.id, name: pet.name, tutor: { id: pet.tutor.id, name: pet.tutor.name } }))}
              />
            </div>
          </div>
        </form>

        <aside className="card">
          <div className="card__header">
            <div className="card__title"><CreditCard /> Resumo</div>
          </div>
          <div className="card__body stack" style={{ gap: 14 }}>
            <ReservationPricingPreview
              formId="reservation-form"
              serviceTypes={serviceOptions}
              seasonPeriods={seasonOptions}
              depositPercent={settings?.depositPercent ?? 50}
            />
            <label className="check" form="reservation-form">
              <input type="checkbox" name="inviteTutor" form="reservation-form" /> Enviar convite ao tutor
            </label>
          </div>
        </aside>
      </div>
    </>
  );
}
