"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { createReservationAction } from "./actions";

type Tutor = { id: string; name: string };
type Pet = { id: string; name: string; tutor: { id: string; name: string } };
type ServiceType = { id: string; name: string };

type Props = {
  tutors: Tutor[];
  pets: Pet[];
  serviceTypes: ServiceType[];
  defaultTutorId?: string;
  defaultPetId?: string;
  triggerVariant?: "primary" | "default";
  triggerLabel?: string;
};

export function NovaReservaModal({
  tutors,
  pets,
  serviceTypes,
  defaultTutorId,
  defaultPetId,
  triggerVariant = "primary",
  triggerLabel = "Nova reserva",
}: Props) {
  const [selectedTutorId, setSelectedTutorId] = useState(defaultTutorId ?? "");
  const filteredPets = selectedTutorId ? pets.filter((p) => p.tutor.id === selectedTutorId) : pets;

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
        <label className="field">
          <span className="field__label">Tutor</span>
          <select
            className="select"
            name="tutorId"
            required
            value={selectedTutorId}
            onChange={(event) => setSelectedTutorId(event.target.value)}
          >
            <option value="">Selecione</option>
            {tutors.map((tutor) => (
              <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Servico</span>
          <select className="select" name="serviceTypeId" required defaultValue={serviceTypes[0]?.id}>
            {serviceTypes.map((serviceType) => (
              <option key={serviceType.id} value={serviceType.id}>{serviceType.name}</option>
            ))}
          </select>
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Pets</span>
          <select
            className="select"
            name="petIds"
            multiple
            required
            defaultValue={defaultPetId ? [defaultPetId] : undefined}
            style={{ minHeight: 96 }}
          >
            {filteredPets.length ? filteredPets.map((pet) => (
              <option key={pet.id} value={pet.id}>{pet.name} - {pet.tutor.name}</option>
            )) : (
              <option disabled>Selecione um tutor para ver os pets</option>
            )}
          </select>
        </label>
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
          <span className="field__label">Distancia taxi pet (km)</span>
          <input className="input" name="distanceKm" defaultValue="0" />
        </label>
        <label className="field">
          <span className="field__label">Valor base</span>
          <input className="input" name="baseAmountCents" placeholder="0,00" />
        </label>
        <label className="field">
          <span className="field__label">Desconto</span>
          <input className="input" name="discountCents" defaultValue="0,00" />
        </label>
        <label className="field">
          <span className="field__label">Adicionais</span>
          <input className="input" name="additionalCents" defaultValue="0,00" />
        </label>
        <label className="check">
          <input type="checkbox" name="inviteTutor" /> Enviar convite ao tutor
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Observacoes</span>
          <textarea className="textarea" name="notes" />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">Salvar reserva</button>
        </div>
      </form>
    </Modal>
  );
}
