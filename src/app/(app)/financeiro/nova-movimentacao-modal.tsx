"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { createFinancialEntryAction } from "./actions";

export function NovaMovimentacaoModal() {
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("EXPENSE");

  return (
    <Modal
      trigger={
        <button type="button" className="btn btn--primary">
          <Plus /> Adicionar movimentação
        </button>
      }
      title="Nova movimentação"
      width={560}
    >
      <form className="form-grid" action={createFinancialEntryAction}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Tipo</span>
          <div className="row" style={{ gap: 8 }}>
            <label className="check" style={{ flex: 1 }}>
              <input
                type="radio"
                name="kind"
                value="INCOME"
                checked={kind === "INCOME"}
                onChange={() => setKind("INCOME")}
              />{" "}
              Receita
            </label>
            <label className="check" style={{ flex: 1 }}>
              <input
                type="radio"
                name="kind"
                value="EXPENSE"
                checked={kind === "EXPENSE"}
                onChange={() => setKind("EXPENSE")}
              />{" "}
              Despesa
            </label>
          </div>
        </div>
        <label className="field">
          <span className="field__label">Categoria</span>
          <input
            className="input"
            name="category"
            placeholder={kind === "INCOME" ? "Serviço extra" : "Insumos"}
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Data</span>
          <input className="input" name="entryDate" type="date" required />
        </label>
        <label className="field">
          <span className="field__label">Valor</span>
          <input className="input" name="amountCents" placeholder="0,00" required />
        </label>
        <label className="field">
          <span className="field__label">Forma de pagamento</span>
          <select className="select" name="method" defaultValue="">
            <option value="">Não informar</option>
            <option value="PIX">PIX</option>
            <option value="CASH">Dinheiro</option>
            <option value="CARD">Cartão</option>
            <option value="TRANSFER">Transferência</option>
            <option value="OTHER">Outro</option>
          </select>
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Descrição</span>
          <input className="input" name="description" placeholder="Detalhe opcional" />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">
            Salvar movimentação
          </button>
        </div>
      </form>
    </Modal>
  );
}
