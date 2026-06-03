import { CalendarClock, CreditCard, PawPrint, Save, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { FlashMessage } from "@/components/ui/flash-message";
import { getReservationDetailData, getReservationFormData } from "@/lib/app-data";
import { reservationEndDay, toDateInputValue } from "@/lib/date";
import { brl } from "@/lib/money";
import {
  calculateManualDailyBaseCents,
  calculatePriceRuleStayCents,
} from "@/lib/pricing";
import {
  toReservationSeasonOptions,
  toReservationServiceOptions,
  withReservationServiceSnapshots,
} from "@/lib/reservation-form-options";
import { inferReservationEditPricingMode, normalizeReservationPricingMode } from "@/lib/reservation-pricing-mode";
import {
  calculateDailyUnitsForKind,
  countHighSeasonStayUnits,
  countHighSeasonUnitsFromDates,
} from "@/lib/rules";
import { updateReservationAction } from "../../actions";
import { ReservationPeriodFields } from "../../reservation-period-fields";
import { ReservationPetFields } from "../../reservation-pet-fields";
import { ReservationPetOverridesFields } from "../../reservation-pet-overrides-fields";
import { ReservationPricingPreview } from "../../reservation-pricing-preview";
import { ServicePriceRuleFields } from "../../service-price-rule-fields";

function centsInput(cents: number | null | undefined) {
  if (!cents) return "0,00";
  return (cents / 100).toFixed(2).replace(".", ",");
}

type ReservationDetail = NonNullable<Awaited<ReturnType<typeof getReservationDetailData>>>;
type ReservationPetDetail = ReservationDetail["reservationPets"][number];
type SeasonPeriodDetail = Awaited<ReturnType<typeof getReservationFormData>>["seasonPeriods"][number];

function hasStoredPetOverride(reservationPet: ReservationPetDetail) {
  return Boolean(
    reservationPet.serviceTypeId ||
      reservationPet.priceRuleId ||
      reservationPet.pricingMode ||
      reservationPet.manualDailyCents != null ||
      reservationPet.manualTotalCents != null,
  );
}

function calculateStoredPetOverrideBaseCents(
  reservationPet: ReservationPetDetail,
  options: {
    chargeableUnits: number;
    highSeasonUnits: number;
    highSeasonSurchargePercent: number;
  },
) {
  const mode = normalizeReservationPricingMode(reservationPet.pricingMode);

  if (mode === "manual_total") {
    return Math.max(reservationPet.manualTotalCents ?? 0, 0);
  }

  if (mode === "manual_daily") {
    if (reservationPet.manualDailyCents == null) return 0;
    return calculateManualDailyBaseCents(reservationPet.manualDailyCents, options.chargeableUnits);
  }

  if (!reservationPet.priceRule) return 0;
  return calculatePriceRuleStayCents(
    reservationPet.priceRule,
    1,
    options.chargeableUnits,
    options.highSeasonUnits,
    { highSeasonSurchargePercent: options.highSeasonSurchargePercent },
  );
}

function calculateFixedBaseForEdit(
  reservation: ReservationDetail,
  seasonPeriods: SeasonPeriodDetail[],
  highSeasonSurchargePercent: number,
) {
  if (!reservation.priceRule) return null;

  const visitDates = reservation.visitDates.map((visitDate) => visitDate.date);
  const chargeableUnits = calculateDailyUnitsForKind({
    kind: reservation.serviceType.kind,
    startsAt: reservation.startsAt,
    endsAt: reservation.endsAt,
    visitDates,
  });
  const highSeasonUnits = visitDates.length
    ? countHighSeasonUnitsFromDates(visitDates, seasonPeriods)
    : countHighSeasonStayUnits(reservation.startsAt, reservation.endsAt, seasonPeriods);
  const priceOptions = { highSeasonSurchargePercent };

  const hasOverrides = reservation.reservationPets.some(hasStoredPetOverride);
  if (!hasOverrides) {
    return calculatePriceRuleStayCents(
      reservation.priceRule,
      reservation.reservationPets.length,
      chargeableUnits,
      highSeasonUnits,
      priceOptions,
    );
  }

  const soloFirstPet = calculatePriceRuleStayCents(
    reservation.priceRule,
    1,
    chargeableUnits,
    highSeasonUnits,
    priceOptions,
  );

  return reservation.reservationPets.reduce((sum, reservationPet) => {
    if (!hasStoredPetOverride(reservationPet)) return sum + soloFirstPet;
    return sum + calculateStoredPetOverrideBaseCents(reservationPet, {
      chargeableUnits,
      highSeasonUnits,
      highSeasonSurchargePercent,
    });
  }, 0);
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

  const serviceOptions = withReservationServiceSnapshots(
    toReservationServiceOptions(formData.serviceTypes),
    [
      { serviceType: reservation.serviceType, priceRule: reservation.priceRule },
      ...reservation.reservationPets.map((item) => ({
        serviceType: item.serviceType,
        priceRule: item.priceRule,
      })),
    ],
  );
  const seasonOptions = toReservationSeasonOptions(formData.seasonPeriods);
  const update = updateReservationAction.bind(null, reservation.id);

  const isPetSitting = reservation.serviceType.kind === "PET_SITTING";
  const startsValue = toDateInputValue(reservation.startsAt);
  const endsValue = toDateInputValue(reservationEndDay(reservation.endsAt, reservation.serviceType.kind));
  const highSeasonSurchargePercent = formData.settings?.highSeasonSurchargePercent ?? 0;
  const fixedBaseForEdit = calculateFixedBaseForEdit(
    reservation,
    formData.seasonPeriods,
    highSeasonSurchargePercent,
  );
  const editPricingMode = inferReservationEditPricingMode({
    persistedMode: reservation.pricingMode,
    savedBaseAmountCents: reservation.baseAmountCents,
    recalculatedFixedBaseCents: fixedBaseForEdit,
  });
  const manualTotalDefaultCents =
    editPricingMode === "manual_total"
      ? reservation.manualTotalCents ?? reservation.baseAmountCents
      : reservation.manualTotalCents;

  const defaultOverrides = Object.fromEntries(
    reservation.reservationPets
      .filter((rp) =>
        rp.serviceTypeId || rp.priceRuleId || rp.pricingMode ||
        rp.manualDailyCents != null || rp.manualTotalCents != null
      )
      .map((rp) => [rp.pet.id, {
        serviceTypeId: rp.serviceTypeId ?? "",
        priceRuleId: rp.priceRuleId ?? "",
        pricingMode: (rp.pricingMode === "manual_daily" || rp.pricingMode === "manual_total" ? rp.pricingMode : "fixed") as "fixed" | "manual_daily" | "manual_total",
        manualDailyAmount: rp.manualDailyCents != null ? centsInput(rp.manualDailyCents) : "",
        manualTotalAmount: rp.manualTotalCents != null ? centsInput(rp.manualTotalCents) : "",
      }]),
  );

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
              <ServicePriceRuleFields
                serviceTypes={serviceOptions}
                defaultServiceTypeId={reservation.serviceType.id}
                defaultPricingMode={editPricingMode}
                defaultPriceRuleId={reservation.priceRule?.id}
              />
              <ReservationPetOverridesFields
                pets={formData.pets.map((pet) => ({ id: pet.id, name: pet.name, tutor: { id: pet.tutor.id, name: pet.tutor.name } }))}
                serviceTypes={serviceOptions}
                formId="reservation-edit-form"
                defaultOverrides={defaultOverrides}
              />
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
                defaultVisitDates={reservation.visitDates.map((v) => toDateInputValue(v.date))}
                defaultServiceTypeId={reservation.serviceType.id}
              />
              <label className="field">
                <span className="field__label">Valor por diária (manual)</span>
                <input className="input" name="manualDailyAmountCents" defaultValue={centsInput(reservation.manualDailyCents)} placeholder="0,00" />
                <span className="subtle" style={{ fontSize: 11 }}>
                  Use quando &ldquo;Valor manual por diária&rdquo; estiver selecionado. Multiplica pelo número de diárias.
                </span>
              </label>
              <label className="field">
                <span className="field__label">Valor total (manual)</span>
                <input className="input" name="manualTotalAmountCents" defaultValue={centsInput(manualTotalDefaultCents)} placeholder="0,00" />
                <span className="subtle" style={{ fontSize: 11 }}>
                  Use quando &ldquo;Valor total manual&rdquo; estiver selecionado.
                </span>
              </label>
              <label className="field">
                <span className="field__label">Taxa de táxi pet (manual)</span>
                <input className="input" name="taxiPetCents" defaultValue={centsInput(reservation.taxiPetCents)} />
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
              highSeasonSurchargePercent={highSeasonSurchargePercent}
              defaultServiceTypeId={reservation.serviceType.id}
              defaultPriceRuleId={reservation.priceRule?.id}
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
