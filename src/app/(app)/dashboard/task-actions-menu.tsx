"use client";

import { MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { deleteTaskAction, updateTaskAction } from "./actions";

type TaskActionsMenuProps = {
  task: {
    id: string;
    title: string;
    description: string | null;
    taskDateValue: string;
    endsAtValue: string;
  };
};

export function TaskActionsMenu({ task }: TaskActionsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const closeDialog = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const openDialog = useCallback(() => {
    setMenuOpen(false);
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const closeOnBackdropClick = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };

    dialog.addEventListener("click", closeOnBackdropClick);
    return () => dialog.removeEventListener("click", closeOnBackdropClick);
  }, []);

  return (
    <div className="task-actions" ref={rootRef}>
      <button
        type="button"
        className="btn btn--ghost btn--icon"
        aria-label={`Ações da tarefa ${task.title}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((current) => !current)}
      >
        <MoreHorizontal />
      </button>

      {menuOpen ? (
        <div className="task-actions__menu" role="menu">
          <button type="button" className="task-actions__item" role="menuitem" onClick={openDialog}>
            <Pencil /> Editar
          </button>
          <ConfirmForm
            action={deleteTaskAction.bind(null, task.id)}
            message="Excluir esta tarefa em todos os dias?"
          >
            <button
              type="submit"
              className="task-actions__item task-actions__item--danger"
              role="menuitem"
            >
              <Trash2 /> Excluir
            </button>
          </ConfirmForm>
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        className="modal"
        style={{ width: 560, maxWidth: "calc(100vw - 32px)" }}
      >
        <div className="modal__header">
          <h2 className="modal__title">Editar tarefa</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label="Fechar"
            onClick={closeDialog}
          >
            <X />
          </button>
        </div>
        <div className="modal__body">
          <form className="form-grid" action={updateTaskAction.bind(null, task.id)}>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="field__label">Título</span>
              <input
                className="input"
                name="title"
                defaultValue={task.title}
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field__label">Início</span>
              <input
                className="input"
                name="taskDate"
                type="datetime-local"
                defaultValue={task.taskDateValue}
                required
              />
            </label>
            <label className="field">
              <span className="field__label">Termina em (opcional)</span>
              <input
                className="input"
                name="endsAt"
                type="datetime-local"
                defaultValue={task.endsAtValue}
              />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="field__label">Descrição</span>
              <textarea
                className="textarea"
                name="description"
                defaultValue={task.description ?? ""}
              />
            </label>
            <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={closeDialog}>Cancelar</button>
              <button type="submit" className="btn btn--primary">Salvar tarefa</button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}
