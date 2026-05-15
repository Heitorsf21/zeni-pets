import { CalendarClock, CreditCard, PawPrint, Save, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { FlashMessage } from "@/components/ui/flash-message";
import { getReservationDetailData, getReservationFormData } from "@/lib/app-data";
import { toDateInputValue } from "@/lib/date";
import { brl } from "@/lib/money";
import { toReservationSeasonOptions, toReservationServiceOptions } from "@/lib/reservation-form-options";
import { updateReservationAction } from "../../actions";
import { ReservationPeriodFields } from "../../reservation-period-fields";
import { ReservationPetFields } from "../../reservation-pet-fields";
import { ReservationPricingPreview } from "../../reservation-pricing-preview";
import { ServicePriceRuleFields } from "../../service-price-rule-fields";

function centsInput(cents: number | null | undefined) {
  if (!cents) return "0,00";
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default async function EditarReservaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const [reservation, formData] = await Promise.all([
    getReservationDetailData(id),
    getReservationFormData(),
  ]);
  if (!reservation) notFound();

  const serviceOptions = toReservationServiceOptions(formData.serviceTypes);
  const seasonOptions = toReservationSeasonOptions(formData.seasonPeriods);
  const update = updateReservationAction.bind(null, reservation.id);

  const isPetSitting = reservation.serviceType.kind === "PET_SITTING";
  const startsValue = toDateInputValue(reservation.startsAt);
  // endsAt is stored as the day AFTER the last selected day (exclusive); subtract one for display.
  const endsDisplay = new Date(reservation.endsAt);
  endsDisplay.setDate(endsDisplay.getDate() - 1);
  const endsValue = toDateInputValue(endsDisplay);

  return (
    <>
      <Topbar
        title={`Editar reserva · ${reservation.tutor.name}`}
        subtitle={`${reservation.serviceType.name} · ${brl(reservation.totalCents)} total`}
        actions={
          <>
            <Link className="btn" href={`/reservas/${reservation.id}`}>Cancelar</Link>
            <button className="btn btn--primary" form="reservation-edit-form" type="submit"><Save /> Salvar alterações</button>
          </>
        }
      />
      {sp.error ? (
        <div className="content stack" style={{ paddingBottom: 0 }}>
          <FlashMessage error={sp.error} />
        </div>
      ) : null}
      <div className="content page-grid">
        <form id="reservation-edit-form" className="stack" action={update}>
          <div className="card">
            <div className="card__header">
              <div className="card__title"><UserRound /> Tutor e pet</div>
            </div>
            <div className="card__body form-grid">
              <ReservationPetFields
                tutors={formData.tutors.map((tutor) => ({ id: tutor.id, name: tutor.name, phone: tutor.phone, email: tutor.email }))}
                pets={formData.pets.map((pet) => ({ id: pet.id, name: pet.name, tutor: { id: pet.tutor.id, name: pet.tutor.name } }))}
                defaultTutorId={reservation.tutor.id}
                defaultPetIds={reservation.reservationPets.map((rp) => rp.pet.id)}
              />
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <div className="card__title"><PawPrint /> Tipo de serviço</div>
            </div>
            <div className="card__body form-grid">
              <ServicePriceRuleFields serviceTypes={serviceOptions} />
              <label className="field">
                <span className="field__label">Retirada</span>
                <select className="select" name="pickupMode" defaultValue={reservation.pickupMode}>
                  <option value="TUTOR_DROPS_OFF">Tutor entrega em mãos</option>
                  <option value="ZENI_PICKUP">Zeni retira na casa do cliente</option>
                </select>
              </label>
              <label className="field">
                <span className="field__label">Distância taxi pet (km)</span>
                <input className="input" name="distanceKm" defaultValue="0" />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card__header">
              <div className="card__title"><CalendarClock /> Período</div>
            </div>
            <div className="card__body form-grid">
              <ReservationPeriodFields
                formId="reservation-edit-form"
                serviceTypes={serviceOptions}
                defaultStartsAt={startsValue}
                defaultEndsAt={isPetSitting ? startsValue : endsValue}
              />
              <label className="field">
                <span className="field__label">Valor base manual</span>
                <input className="input" name="baseAmountCents" placeholder="automático" defaultValue={centsInput(reservation.baseAmountCents)} />
              </label>
              <label className="field">
                <span className="field__label">Desconto</span>
                <input className="input" name="discountCents" defaultValue={centsInput(reservation.discountCents)} />
              </label>
              <label className="field">
                <span className="field__label">Adicionais</span>
                <input className="input" name="additionalCents" defaultValue={centsInput(reservation.additionalCents)} />
              </label>
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                <span className="field__label">Observações da reserva</span>
                <textarea className="textarea" name="notes" defaultValue={reservation.notes ?? ""} />
              </label>
            </div>
          </div>

          <p className="subtle" style={{ fontSize: 12, margin: 0 }}>
            Pagamentos existentes são preservados. O status de pagamento é recalculado com base no novo total.
          </p>
        </form>

        <aside className="card">
          <div className="card__header">
            <div className="card__title"><CreditCard /> Resumo atualizado</div>
          </div>
          <div className="card__body stack" style={{ gap: 14 }}>
            <ReservationPricingPreview
              formId="reservation-edit-form"
              serviceTypes={serviceOptions}
              seasonPeriods={seasonOptions}
              depositPercent={formData.settings?.depositPercent ?? 50}
            />
            <label className="check" form="reservation-edit-form">
              <input
                type="checkbox"
                name="inviteTutor"
                form="reservation-edit-form"
                defaultChecked={reservation.inviteTutor}
              /> Enviar convite ao tutor
            </label>
          </div>
        </aside>
      </div>
    </>
  );
}
