"use client";

import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { createTutorAction } from "./actions";

export function NovoTutorModal() {
  return (
    <Modal
      trigger={
        <button type="button" className="btn btn--primary">
          <Plus /> Novo tutor
        </button>
      }
      title="Novo tutor"
    >
      <form className="form-grid" action={createTutorAction}>
        <label className="field">
          <span className="field__label">Nome</span>
          <input className="input" name="name" required autoFocus />
        </label>
        <label className="field">
          <span className="field__label">Telefone</span>
          <input className="input" name="phone" />
        </label>
        <label className="field">
          <span className="field__label">CPF/RG</span>
          <input className="input" name="document" />
        </label>
        <label className="field">
          <span className="field__label">Nascimento</span>
          <input className="input" name="birthDate" type="date" min="1900-01-01" />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Endereço</span>
          <input className="input" name="address" />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Observações</span>
          <textarea className="textarea" name="notes" />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">Salvar tutor</button>
        </div>
      </form>
    </Modal>
  );
}
