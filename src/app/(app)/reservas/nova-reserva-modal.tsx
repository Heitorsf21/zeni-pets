"use client";

import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { ReservationSeasonOption, ReservationServiceOption } from "@/lib/reservation-form-options";
import { createReservationAction } from "./actions";
import { ReservationPetFields } from "./reservation-pet-fields";
import { ReservationPricingPreview } from "./reservation-pricing-preview";
import { ReservationTaskFields } from "./reservation-task-fields";
import { ServicePriceRuleFields } from "./service-price-rule-fields";

type Tutor = { id: string; name: string };
type Pet = { id: string; name: string; tutor: { id: string; name: string } };
type Props = {
  tutors: Tutor[];
  pets: Pet[];
  serviceTypes: ReservationServiceOption[];
  seasonPeriods?: ReservationSeasonOption[];
  depositPercent?: number;
  defaultTutorId?: string;
  defaultPetId?: string;
  triggerVariant?: "primary" | "default";
  triggerLabel?: string;
};

export function NovaReservaModal({
  tutors,
  pets,
  serviceTypes,
  seasonPeriods = [],
  depositPercent = 50,
  defaultTutorId,
  defaultPetId,
  triggerVariant = "primary",
  triggerLabel = "Nova reserva",
}: Props) {
  return (
    <Modal
      trigger={
        <button type="button" className={triggerVariant === "primary" ? "btn btn--primary" : "btn"}>
          <Plus /> {triggerLabel}
        </button>
      }
      title="Nova reserva"
      width={680}
    >
      <form className="form-grid" action={createReservationAction}>
        <ReservationPetFields
          tutors={tutors}
          pets={pets}
          defaultTutorId={defaultTutorId}
          defaultPetId={defaultPetId}
        />
        <ServicePriceRuleFields serviceTypes={serviceTypes} />
        <label className="field">
          <span className="field__label">Check-in</span>
          <input className="input" name="startsAt" type="datetime-local" required />
        </label>
        <label className="field">
          <span className="field__label">Check-out</span>
          <input className="input" name="endsAt" type="datetime-local" required />
        </label>
        <label className="field">
          <span className="field__label">Retirada</span>
          <select className="select" name="pickupMode" defaultValue="TUTOR_DROPS_OFF">
            <option value="TUTOR_DROPS_OFF">Tutor entrega</option>
            <option value="ZENI_PICKUP">Zeni retira</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Distância taxi pet (km)</span>
          <input className="input" name="distanceKm" defaultValue="0" />
        </label>
        <label className="field">
          <span className="field__label">Valor base manual</span>
          <input className="input" name="baseAmountCents" placeholder="automático" />
        </label>
        <label className="field">
          <span className="field__label">Desconto</span>
          <input className="input" name="discountCents" defaultValue="0,00" />
        </label>
        <label className="field">
          <span className="field__label">Adicionais</span>
          <input className="input" name="additionalCents" defaultValue="0,00" />
        </label>
        <ReservationPricingPreview
          serviceTypes={serviceTypes}
          seasonPeriods={seasonPeriods}
          depositPercent={depositPercent}
          compact
        />
        <ReservationTaskFields pets={pets} />
        <label className="check">
          <input type="checkbox" name="inviteTutor" /> Enviar convite ao tutor
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Observações</span>
          <textarea className="textarea" name="notes" />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">Salvar reserva</button>
        </div>
      </form>
    </Modal>
  );
}
