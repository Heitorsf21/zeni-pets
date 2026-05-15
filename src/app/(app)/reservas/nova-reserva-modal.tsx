"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { ReservationSeasonOption, ReservationServiceOption } from "@/lib/reservation-form-options";
import { createReservationAction } from "./actions";
import { NovaReservaHome } from "./nova-reserva-home";
import { ReservationPeriodFields } from "./reservation-period-fields";
import { ReservationPetFields } from "./reservation-pet-fields";
import { ReservationPetOverridesFields } from "./reservation-pet-overrides-fields";
import { ReservationPricingPreview } from "./reservation-pricing-preview";
import { ReservationTaskFields } from "./reservation-task-fields";
import { ServicePriceRuleFields } from "./service-price-rule-fields";

type Tutor = { id: string; name: string; phone?: string | null; email?: string | null };
type Pet = { id: string; name: string; tutor: { id: string; name: string } };
type ServiceOptionWithColor = ReservationServiceOption & { color?: string | null };

type Props = {
  tutors: Tutor[];
  pets: Pet[];
  serviceTypes: ServiceOptionWithColor[];
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
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState<string | null>(null);

  const selectedService = useMemo(
    () => serviceTypes.find((service) => service.id === selectedServiceTypeId) ?? null,
    [serviceTypes, selectedServiceTypeId],
  );

  const kind = selectedService?.kind ?? "";

  function back() {
    setSelectedServiceTypeId(null);
  }

  return (
    <Modal
      trigger={
        <button type="button" className={triggerVariant === "primary" ? "btn btn--primary" : "btn"}>
          <Plus /> {triggerLabel}
        </button>
      }
      title="Nova reserva"
      width={720}
    >
      {!selectedService ? (
        <NovaReservaHome
          serviceTypes={serviceTypes}
          onSelect={(id) => setSelectedServiceTypeId(id)}
        />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row" style={{ alignItems: "center", gap: 10 }}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={back}
              aria-label="Voltar para a seleção de serviço"
            >
              <ArrowLeft style={{ width: 14, height: 14 }} /> Voltar
            </button>
            <strong style={{ fontSize: 14 }}>{selectedService.name}</strong>
          </div>

          <form className="form-grid" action={createReservationAction}>
            <input type="hidden" name="serviceTypeId" value={selectedService.id} />

            <ReservationPetFields
              tutors={tutors}
              pets={pets}
              defaultTutorId={defaultTutorId}
              defaultPetId={defaultPetId}
            />

            <ServicePriceRuleFields serviceTypes={[selectedService]} lockServiceType />

            <ReservationPetOverridesFields pets={pets} serviceTypes={serviceTypes} />

            <ReservationPeriodFields
              serviceTypes={serviceTypes}
              forcedKind={kind}
            />

            <label className="field">
              <span className="field__label">Valor por diária (manual)</span>
              <input
                className="input"
                name="manualDailyAmountCents"
                placeholder="0,00"
              />
              <span className="subtle" style={{ fontSize: 11 }}>
                Use quando &ldquo;Valor manual por diária&rdquo; estiver selecionado. Multiplica pelo número de diárias.
              </span>
            </label>

            <label className="field">
              <span className="field__label">Valor total (manual)</span>
              <input
                className="input"
                name="manualTotalAmountCents"
                placeholder="0,00"
              />
              <span className="subtle" style={{ fontSize: 11 }}>
                Use quando &ldquo;Valor total manual&rdquo; estiver selecionado. Vai direto, sem multiplicar.
              </span>
            </label>

            <label className="field">
              <span className="field__label">Taxa de táxi pet (manual)</span>
              <input
                className="input"
                name="taxiPetCents"
                defaultValue="0,00"
                placeholder="0,00"
              />
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
        </div>
      )}
    </Modal>
  );
}
