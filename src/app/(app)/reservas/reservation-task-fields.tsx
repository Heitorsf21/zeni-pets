"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Pet = { id: string; name: string; tutor: { id: string; name: string } };

type Props = {
  pets: Pet[];
  formId?: string;
};

export function ReservationTaskFields({ pets, formId }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nextTaskId = useRef(1);
  const [taskRows, setTaskRows] = useState<Array<{ id: number }>>([]);
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);

  useEffect(() => {
    const form = formId
      ? document.getElementById(formId)
      : rootRef.current?.closest("form");
    if (!(form instanceof HTMLFormElement)) return;

    let frame = 0;
    const update = () => {
      const formData = new FormData(form);
      setSelectedPetIds(formData.getAll("petIds").map(String).filter(Boolean));
    };
    const queueUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    form.addEventListener("change", queueUpdate);
    form.addEventListener("input", queueUpdate);

    return () => {
      cancelAnimationFrame(frame);
      form.removeEventListener("change", queueUpdate);
      form.removeEventListener("input", queueUpdate);
    };
  }, [formId]);

  const selectedPets = useMemo(
    () => selectedPetIds
      .map((id) => pets.find((pet) => pet.id === id))
      .filter((pet): pet is Pet => Boolean(pet)),
    [pets, selectedPetIds],
  );

  function addTaskRow() {
    setTaskRows((current) => [...current, { id: nextTaskId.current++ }]);
  }

  function removeTaskRow(id: number) {
    setTaskRows((current) => current.filter((task) => task.id !== id));
  }

  return (
    <div ref={rootRef} className="stack" style={{ gridColumn: "1 / -1", gap: 12 }}>
      {taskRows.length === 0 ? (
        <div className="row">
          <button className="btn btn--sm" type="button" onClick={addTaskRow}>
            <Plus /> Adicionar tarefa
          </button>
        </div>
      ) : (
        <div className="row row--between">
          <span className="muted" style={{ fontSize: 12 }}>
            {taskRows.length} {taskRows.length === 1 ? "tarefa vinculada" : "tarefas vinculadas"} a esta reserva
          </span>
          <button className="btn btn--sm" type="button" onClick={addTaskRow}>
            <Plus /> Adicionar tarefa
          </button>
        </div>
      )}

      {taskRows.map((task, index) => (
        <div
          className="form-grid"
          key={task.id}
          style={{
            gridColumn: "1 / -1",
            borderTop: "1px solid var(--border)",
            paddingTop: 12,
          }}
        >
          <div className="row row--between" style={{ gridColumn: "1 / -1" }}>
            <strong style={{ fontSize: 13 }}>Tarefa {index + 1}</strong>
            <button
              className="btn btn--ghost btn--icon"
              type="button"
              aria-label={`Remover tarefa ${index + 1}`}
              title="Remover tarefa"
              onClick={() => removeTaskRow(task.id)}
            >
              <Trash2 />
            </button>
          </div>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="field__label">Título da tarefa</span>
            <input className="input" name="reservationTaskTitle" placeholder="Ex.: Dar medicação" required />
          </label>

          {selectedPets.length === 1 ? (
            <>
              <input type="hidden" name="reservationTaskPetId" value={selectedPets[0].id} />
              <p className="muted" style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12 }}>
                A tarefa será vinculada automaticamente a <strong>{selectedPets[0].name}</strong>.
              </p>
            </>
          ) : null}

          {selectedPets.length > 1 ? (
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="field__label">Pet da tarefa</span>
              <select className="select" name="reservationTaskPetId" required>
                <option value="">Selecione</option>
                {selectedPets.map((pet) => (
                  <option key={pet.id} value={pet.id}>{pet.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedPets.length === 0 ? (
            <>
              <input type="hidden" name="reservationTaskPetId" value="" />
              <p className="muted" style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12 }}>
                Selecione ao menos um pet para vincular a tarefa.
              </p>
            </>
          ) : null}

          <label className="field">
            <span className="field__label">Início da tarefa</span>
            <input className="input" name="reservationTaskDate" type="datetime-local" />
          </label>
          <label className="field">
            <span className="field__label">Termina em (opcional)</span>
            <input className="input" name="reservationTaskEndsAt" type="datetime-local" />
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="field__label">Descrição da tarefa</span>
            <textarea className="textarea" name="reservationTaskDescription" placeholder="Detalhes que ajudam na execução da tarefa" />
          </label>
        </div>
      ))}
    </div>
  );
}
