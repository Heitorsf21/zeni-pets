"use client";

import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { createTaskAction } from "./actions";

type Props = {
  triggerLabel?: string;
  /** When set, the task is created bound to that pet (no tutor/pet picker). */
  petId?: string;
  petLabel?: string;
};

export function NovaTarefaModal({ triggerLabel = "Nova tarefa", petId, petLabel }: Props) {
  return (
    <Modal
      trigger={
        <button type="button" className="btn">
          <Plus /> {triggerLabel}
        </button>
      }
      title="Nova tarefa"
    >
      <form className="form-grid" action={createTaskAction}>
        {petId ? <input type="hidden" name="petId" value={petId} /> : null}
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Titulo</span>
          <input className="input" name="title" placeholder="Ex.: Dar racao da manha" required autoFocus />
        </label>
        {petLabel ? (
          <p className="muted" style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12 }}>
            Tarefa vinculada a <strong>{petLabel}</strong>.
          </p>
        ) : null}
        <label className="field">
          <span className="field__label">Inicio</span>
          <input className="input" name="taskDate" type="datetime-local" required />
        </label>
        <label className="field">
          <span className="field__label">Termina em (opcional)</span>
          <input className="input" name="endsAt" type="datetime-local" />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Descricao</span>
          <textarea className="textarea" name="description" placeholder="Detalhes que ajudam na execucao da tarefa" />
        </label>
        <p className="subtle" style={{ gridColumn: "1 / -1", margin: 0, fontSize: 11 }}>
          Quando voce define um termino, a tarefa aparece todo dia entre o inicio e o fim e pode ser concluida em cada dia.
        </p>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">Salvar tarefa</button>
        </div>
      </form>
    </Modal>
  );
}
