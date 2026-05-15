"use client";

import { Edit } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { toDateInputValue } from "@/lib/date";

type Tutor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  cep: string | null;
  birthDate: Date | null;
  address: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
};

type Props = {
  tutor: Tutor;
  canDelete: boolean;
  updateAction: (formData: FormData) => Promise<void>;
  toggleStatusAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  triggerVariant?: "primary" | "default";
  triggerLabel?: string;
};

export function EditarTutorModal({
  tutor,
  canDelete,
  updateAction,
  toggleStatusAction,
  deleteAction,
  triggerVariant = "default",
  triggerLabel = "Editar",
}: Props) {
  return (
    <Modal
      trigger={
        <button type="button" className={triggerVariant === "primary" ? "btn btn--primary" : "btn"}>
          <Edit /> {triggerLabel}
        </button>
      }
      title="Editar ficha do tutor"
      width={680}
    >
      <form className="form-grid" action={updateAction}>
        <label className="field">
          <span className="field__label">Nome</span>
          <input className="input" name="name" defaultValue={tutor.name} required autoFocus />
        </label>
        <label className="field">
          <span className="field__label">Telefone</span>
          <input className="input" name="phone" defaultValue={tutor.phone ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">E-mail</span>
          <input className="input" name="email" type="email" defaultValue={tutor.email ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">CPF/RG</span>
          <input className="input" name="document" defaultValue={tutor.document ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">CEP</span>
          <input className="input" name="cep" defaultValue={tutor.cep ?? ""} />
        </label>
        <label className="field">
          <span className="field__label">Nascimento</span>
          <input
            className="input"
            name="birthDate"
            type="date"
            min="1900-01-01"
            defaultValue={tutor.birthDate ? toDateInputValue(tutor.birthDate) : ""}
          />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Endereço</span>
          <textarea className="textarea" name="address" defaultValue={tutor.address ?? ""} />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Observações</span>
          <textarea className="textarea" name="notes" defaultValue={tutor.notes ?? ""} />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">Salvar ficha</button>
        </div>
      </form>
      <div className="row row--between" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <form action={toggleStatusAction}>
          <button className="btn" type="submit">
            {tutor.status === "ACTIVE" ? "Inativar tutor" : "Reativar tutor"}
          </button>
        </form>
        <ConfirmForm
          action={deleteAction}
          message={`Excluir o tutor ${tutor.name}? Essa ação não pode ser desfeita.`}
        >
          <button
            className="btn btn--danger"
            type="submit"
            disabled={!canDelete}
            title={canDelete ? "Excluir tutor" : "Tutor possui reservas vinculadas"}
          >
            Excluir tutor
          </button>
        </ConfirmForm>
      </div>
      {!canDelete ? (
        <p className="subtle" style={{ marginTop: 6, fontSize: 11 }}>
          Para excluir, remova ou cancele as reservas vinculadas.
        </p>
      ) : null}
    </Modal>
  );
}
