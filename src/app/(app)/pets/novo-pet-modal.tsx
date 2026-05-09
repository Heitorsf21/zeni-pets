"use client";

import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { createPetAction } from "./actions";

type Tutor = { id: string; name: string };

type Props = {
  tutors?: Tutor[];
  defaultTutorId?: string;
  /** Hide the tutor select when creating from a tutor's ficha. */
  fixedTutorId?: string;
  triggerLabel?: string;
};

export function NovoPetModal({ tutors, defaultTutorId, fixedTutorId, triggerLabel = "Novo pet" }: Props) {
  return (
    <Modal
      trigger={
        <button type="button" className="btn btn--primary">
          <Plus /> {triggerLabel}
        </button>
      }
      title="Novo pet"
    >
      <form className="form-grid" action={createPetAction}>
        {fixedTutorId ? (
          <input type="hidden" name="tutorId" value={fixedTutorId} />
        ) : (
          <label className="field">
            <span className="field__label">Tutor</span>
            <select className="select" name="tutorId" defaultValue={defaultTutorId ?? ""} required>
              <option value="">Selecione</option>
              {tutors?.map((tutor) => (
                <option key={tutor.id} value={tutor.id}>{tutor.name}</option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span className="field__label">Nome do pet</span>
          <input className="input" name="name" required autoFocus />
        </label>
        <label className="field">
          <span className="field__label">Especie</span>
          <select className="select" name="species" defaultValue="dog">
            <option value="dog">Cachorro</option>
            <option value="cat">Gato</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label className="field"><span className="field__label">Raca</span><input className="input" name="breed" /></label>
        <label className="field"><span className="field__label">Idade</span><input className="input" name="ageLabel" /></label>
        <div className="row" style={{ gridColumn: "1 / -1" }}>
          <label className="check"><input type="checkbox" name="isNeutered" /> Castrado</label>
          <label className="check"><input type="checkbox" name="isSociable" /> Sociavel</label>
        </div>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Alimentacao</span>
          <textarea className="textarea" name="foodNotes" />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Saude</span>
          <textarea className="textarea" name="healthNotes" />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">Salvar pet</button>
        </div>
      </form>
    </Modal>
  );
}
