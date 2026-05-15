"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
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
  const [ageMode, setAgeMode] = useState<"text" | "date">("text");
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
          <span className="field__label">Espécie</span>
          <select className="select" name="species" defaultValue="dog">
            <option value="dog">Cachorro</option>
            <option value="cat">Gato</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label className="field"><span className="field__label">Raça</span><input className="input" name="breed" /></label>
        <div className="field">
          <span className="field__label">Idade</span>
          <div className="row" style={{ gap: 12, marginBottom: 6 }}>
            <label className="check">
              <input
                type="radio"
                name="ageMode"
                value="text"
                checked={ageMode === "text"}
                onChange={() => setAgeMode("text")}
              />
              Idade aproximada
            </label>
            <label className="check">
              <input
                type="radio"
                name="ageMode"
                value="date"
                checked={ageMode === "date"}
                onChange={() => setAgeMode("date")}
              />
              Data de nascimento
            </label>
          </div>
          {ageMode === "text" ? (
            <input
              className="input"
              name="ageLabel"
              type="number"
              min={0}
              max={40}
              step={1}
              inputMode="numeric"
              placeholder="Anos"
              aria-label="Idade aproximada em anos"
            />
          ) : (
            <input
              className="input"
              name="birthDate"
              type="date"
              min="1990-01-01"
              autoComplete="bday"
              aria-label="Data de nascimento"
            />
          )}
        </div>
        <div className="row" style={{ gridColumn: "1 / -1" }}>
          <label className="check"><input type="checkbox" name="isNeutered" /> Castrado</label>
          <label className="check"><input type="checkbox" name="isSociable" /> Sociável</label>
        </div>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Rotina alimentar</span>
          <textarea className="textarea" name="foodNotes" placeholder="Quantidade, horários, tipo de ração..." />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Restrições alimentares</span>
          <textarea className="textarea" name="foodRestrictions" placeholder="Alergias, intolerâncias, alimentos proibidos..." />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Petiscos</span>
          <textarea className="textarea" name="foodTreats" placeholder="O que pode receber, frequência..." />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Saúde</span>
          <textarea className="textarea" name="healthNotes" />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Pontos de atenção</span>
          <textarea className="textarea" name="attentionNotes" placeholder="Cuidados especiais a destacar na entrada/saída..." />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">Salvar pet</button>
        </div>
      </form>
    </Modal>
  );
}
