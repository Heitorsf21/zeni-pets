"use client";

import { Edit } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ConfirmForm } from "@/components/ui/confirm-form";

type Pet = {
  id: string;
  name: string;
  species: string | null;
  breed: string | null;
  ageLabel: string | null;
  isNeutered: boolean | null;
  isSociable: boolean | null;
  foodNotes: string | null;
  healthNotes: string | null;
  behaviorNotes: string | null;
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
          <span className="field__label">Especie</span>
          <select className="select" name="species" defaultValue={pet.species ?? "dog"}>
            <option value="dog">Cachorro</option>
            <option value="cat">Gato</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Raca</span>
          <input className="input" name="breed" defaultValue={pet.breed ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">Idade</span>
          <input className="input" name="ageLabel" defaultValue={pet.ageLabel ?? ""} />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1" }}>
          <label className="check">
            <input type="checkbox" name="isNeutered" defaultChecked={Boolean(pet.isNeutered)} /> Castrado
          </label>
          <label className="check">
            <input type="checkbox" name="isSociable" defaultChecked={Boolean(pet.isSociable)} /> Sociavel
          </label>
        </div>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Alimentacao</span>
          <textarea className="textarea" name="foodNotes" defaultValue={pet.foodNotes ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Saude</span>
          <textarea className="textarea" name="healthNotes" defaultValue={pet.healthNotes ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Comportamento</span>
          <textarea className="textarea" name="behaviorNotes" defaultValue={pet.behaviorNotes ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">Veterinario</span>
          <input className="input" name="vetName" defaultValue={pet.vetName ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">Telefone veterinario</span>
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
          message={`Excluir o pet ${pet.name}? Essa acao nao pode ser desfeita.`}
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
