"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { updateFinancialEntryAction } from "./actions";

type FinanceEntryForEdit = {
  id: string;
  kind: "INCOME" | "EXPENSE";
  category: string;
  descriptionValue: string;
  dateValue: string;
  amountInput: string;
  methodValue: string;
  reservationId: string | null;
};

export function EditarMovimentacaoModal({ entry }: { entry: FinanceEntryForEdit }) {
  const isReservationEntry = Boolean(entry.reservationId);
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">(isReservationEntry ? "INCOME" : entry.kind);

  return (
    <Modal
      trigger={
        <button type="button" className="btn btn--ghost btn--icon" aria-label="Editar lançamento" title="Editar lançamento">
          <Pencil />
        </button>
      }
      title="Editar movimentação"
      width={560}
    >
      <form className="form-grid" action={updateFinancialEntryAction.bind(null, entry.id)}>
        {isReservationEntry ? <input type="hidden" name="kind" value="INCOME" /> : null}
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Tipo</span>
          <div className="row" style={{ gap: 8 }}>
            <label className="check" style={{ flex: 1 }}>
              <input
                type="radio"
                name={isReservationEntry ? undefined : "kind"}
                value="INCOME"
                checked={kind === "INCOME"}
                disabled={isReservationEntry}
                onChange={() => setKind("INCOME")}
              />{" "}
              Receita
            </label>
            <label className="check" style={{ flex: 1 }}>
              <input
                type="radio"
                name={isReservationEntry ? undefined : "kind"}
                value="EXPENSE"
                checked={kind === "EXPENSE"}
                disabled={isReservationEntry}
                onChange={() => setKind("EXPENSE")}
              />{" "}
              Despesa
            </label>
          </div>
        </div>
        <label className="field">
          <span className="field__label">Categoria</span>
          <input className="input" name="category" defaultValue={entry.category} required />
        </label>
        <label className="field">
          <span className="field__label">Data</span>
          <input className="input" name="entryDate" type="date" defaultValue={entry.dateValue} required />
        </label>
        <label className="field">
          <span className="field__label">Valor</span>
          <input className="input" name="amountCents" defaultValue={entry.amountInput} required />
        </label>
        <label className="field">
          <span className="field__label">Forma de pagamento</span>
          <select className="select" name="method" defaultValue={entry.methodValue}>
            <option value="">Não informar</option>
            <option value="PIX">PIX</option>
            <option value="CASH">Dinheiro</option>
            <option value="CARD">Cartão</option>
            <option value="TRANSFER">Transferência</option>
            <option value="CREDIT">Crédito</option>
            <option value="OTHER">Outro</option>
          </select>
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Descrição</span>
          <input className="input" name="description" defaultValue={entry.descriptionValue} />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">
            Salvar alterações
          </button>
        </div>
      </form>
    </Modal>
  );
}
