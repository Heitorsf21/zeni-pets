"use client";

import { WalletCards } from "lucide-react";
import { Modal } from "@/components/ui/modal";

type Props = {
  balance: string;
  action: (formData: FormData) => Promise<void>;
};

export function CreditoTutorModal({ balance, action }: Props) {
  return (
    <Modal
      trigger={
        <button type="button" className="btn">
          <WalletCards /> Ajustar crédito
        </button>
      }
      title="Ajustar crédito do cliente"
      width={560}
    >
      <form className="form-grid" action={action}>
        <div className="alert" style={{ gridColumn: "1 / -1" }}>
          Credito disponivel agora: <strong>{balance}</strong>
        </div>
        <label className="field">
          <span className="field__label">Operação</span>
          <select className="select" name="operation" defaultValue="ADD">
            <option value="ADD">Adicionar crédito</option>
            <option value="REMOVE">Remover / corrigir crédito</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Valor</span>
          <input className="input" name="amountCents" placeholder="100,00" required />
        </label>
        <label className="field" style={{ gridColumn: "1 / -1" }}>
          <span className="field__label">Motivo</span>
          <input
            className="input"
            name="description"
            placeholder="Ex.: sinal mantido em crédito para próxima visita"
          />
        </label>
        <div className="row" style={{ gridColumn: "1 / -1", justifyContent: "flex-end" }}>
          <button className="btn btn--primary" type="submit">Salvar crédito</button>
        </div>
      </form>
    </Modal>
  );
}
