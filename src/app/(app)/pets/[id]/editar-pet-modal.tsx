"use client";

import { Edit } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { toDateInputValue } from "@/lib/date";

type Pet = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  ageLabel: string | null;
  ageReferenceYear: number | null;
  birthDate: Date | null;
  isNeutered: boolean | null;
  isSociable: boolean | null;
  foodNotes: string | null;
  foodRestrictions: string | null;
  foodTreats: string | null;
  healthNotes: string | null;
  behaviorNotes: string | null;
  historyNotes: string | null;
  attentionNotes: string | null;
  vetName: string | null;
  vetPhone: string | null;
  deliveredItems: string | null;
};

type Props = {
  pet: Pet;
  canDelete: boolean;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  triggerVariant?: "primary" | "default";
  triggerLabel?: string;
};

export function EditarPetModal({
  pet,
  canDelete,
  updateAction,
  deleteAction,
  triggerVariant = "default",
  triggerLabel = "Editar ficha",
}: Props) {
  const [ageMode, setAgeMode] = useState<"text" | "date">(pet.birthDate ? "date" : "text");
  return (
    <Modal
      trigger={
        <button type="button" className={triggerVariant === "primary" ? "btn btn--primary" : "btn"}>
          <Edit /> {triggerLabel}
        </button>
      }
      title="Editar ficha do pet"
      width={680}
    >
      <form className="form-grid" action={updateAction}>
        <label className="field">
          <span className="field__label">Nome</span>
          <input className="input" name="name" defaultValue={pet.name} required autoFocus />
        </label>
        <label className="field">
          <span className="field__label">Espécie</span>
          <select className="select" name="species" defaultValue={pet.species ?? "dog"}>
            <option value="dog">Cachorro</option>
            <option value="cat">Gato</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Raça</span>
          <input className="input" name="breed" defaultValue={pet.breed ?? ""} />
        </label>
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
            <>
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
                defaultValue={pet.ageLabel?.match(/(\d+)/)?.[1] ?? ""}
              />
              {pet.ageReferenceYear ? (
                <span className="subtle" style={{ fontSize: 11 }}>
                  Idade registrada em {pet.ageReferenceYear}
                </span>
              ) : null}
            </>
          ) : (
            <>
              <input
                className="input"
                name="birthDate"
                type="date"
                min="1990-01-01"
                autoComplete="bday"
                aria-label="Data de nascimento"
                defaultValue={pet.birthDate ? toDateInputValue(pet.birthDate) : ""}
              />
              <span className="subtle" style={{ fontSize: 11 }}>
                Idade calculada automaticamente da data de nascimento.
              </span>
            </>
          )}
        </div>
        <div className="row" style={{ gridColumn: "1 / -1" }}>
          <label className="check">
            <input type="checkbox" name="isNeutered" defaultChecked={Boolean(pet.isNeutered)} /> Castrado
          </label>
          <label className="check">
            <input type="checkbox" name="isSociable" defaultChecked={Boolean(pet.isSociable)} /> Sociável
          </label>
        </div>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Rotina alimentar</span>
          <textarea className="textarea" name="foodNotes" defaultValue={pet.foodNotes ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Restrições alimentares</span>
          <textarea className="textarea" name="foodRestrictions" defaultValue={pet.foodRestrictions ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Petiscos</span>
          <textarea className="textarea" name="foodTreats" defaultValue={pet.foodTreats ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Saúde</span>
          <textarea className="textarea" name="healthNotes" defaultValue={pet.healthNotes ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Comportamento</span>
          <textarea className="textarea" name="behaviorNotes" defaultValue={pet.behaviorNotes ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Histórico (observações livres)</span>
          <textarea className="textarea" name="historyNotes" defaultValue={pet.historyNotes ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Pontos de atenção</span>
          <textarea className="textarea" name="attentionNotes" defaultValue={pet.attentionNotes ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">Veterinário</span>
          <input className="input" name="vetName" defaultValue={pet.vetName ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">Telefone veterinário</span>
          <input className="input" name="vetPhone" defaultValue={pet.vetPhone ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Itens</span>
          <textarea className="textarea" name="deliveredItems" defaultValue={pet.deliveredItems ?? ""} />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">Salvar ficha</button>
        </div>
      </form>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <ConfirmForm
          action={deleteAction}
          message={`Excluir o pet ${pet.name}? Essa ação não pode ser desfeita.`}
        >
          <button
            className="btn btn--danger"
            type="submit"
            disabled={!canDelete}
            title={canDelete ? "Excluir pet" : "Pet possui reservas vinculadas"}
          >
            Excluir pet
          </button>
        </ConfirmForm>
        {!canDelete ? (
          <p className="subtle" style={{ marginTop: 6, fontSize: 11 }}>
            Para excluir, remova as reservas vinculadas a este pet.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
