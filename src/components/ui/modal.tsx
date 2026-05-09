"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  /** Optional outer width — falls back to a sensible default. */
  width?: number;
};

export function Modal({ trigger, title, children, width }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const handleOpen = useCallback(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleBackdropClick = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close();
    };
    dialog.addEventListener("click", handleBackdropClick);
    return () => dialog.removeEventListener("click", handleBackdropClick);
  }, []);

  return (
    <>
      <span onClick={handleOpen} style={{ display: "inline-flex" }}>{trigger}</span>
      <dialog
        ref={dialogRef}
        className="modal"
        style={{ width: width ?? 560, maxWidth: "calc(100vw - 32px)" }}
      >
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            aria-label="Fechar"
            onClick={close}
          >
            <X />
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </dialog>
    </>
  );
}
