const ERROR_MESSAGES: Record<string, string> = {
  "tutor-com-reservas": "Tutor possui reservas vinculadas. Inative em vez de excluir.",
  "pet-em-reservas": "Pet possui reservas vinculadas e não pode ser removido.",
  "reserva-nao-removivel": "Só é possível excluir reservas com status pendente ou cancelada.",
  "reserva-nao-encontrada": "Reserva não encontrada.",
  "tutor-nao-encontrado": "Tutor não encontrado.",
  "lancamento-automatico": "Lançamentos automáticos vinculados a reservas não podem ser removidos aqui.",
  "lancamento-nao-encontrado": "Lançamento não encontrado.",
  "valor-invalido": "Informe um valor válido.",
  "credito-insuficiente": "O cliente não tem crédito suficiente para esta operação.",
  "valor-base-invalido": "Valor base inválido. Use formato 200,00.",
  "distancia-invalida": "Distância inválida. Use números como 8 ou 8,5.",
  "datas-invalidas": "A data de check-out deve ser posterior ao check-in.",
  "pets-do-tutor": "Selecione apenas pets do tutor escolhido.",
  "dados-obrigatorios": "Preencha todos os campos obrigatorios.",
  "dados-invalidos": "Verifique os dados informados.",
  "tarefa-titulo-obrigatorio": "Informe o título da tarefa da reserva.",
  "tarefa-pet-obrigatorio": "Selecione o pet responsavel pela tarefa.",
  "periodo-invalido": "Não foi possível reconhecer o período. Revise a data do registro antes de importar.",
  "nome-obrigatorio": "Informe o nome.",
  "calendario-obrigatorio": "Informe o ID do calendário.",
  "google-nao-conectado": "Conecte uma conta Google antes de salvar o calendário.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  "1": "Alteracoes salvas com sucesso.",
  saved: "Alteracoes salvas com sucesso.",
  credit: "Credito atualizado com sucesso.",
  deleted: "Registro removido.",
  connected: "Conta Google conectada.",
  "calendar-saved": "Calendario salvo.",
  "sync-complete": "Sincronização com Google Agenda concluída.",
  "webhook-reactivated": "Webhook do Google Agenda reativado.",
  disconnected: "Conta Google desconectada.",
};

type FlashKind = "error" | "deleted" | "saved" | "google" | "merged";

export function FlashMessage({
  error,
  saved,
  deleted,
  google,
  merged,
  mergedFrom,
}: {
  error?: string | null;
  saved?: string | null;
  deleted?: string | null;
  google?: string | null;
  merged?: string | null;
  mergedFrom?: string | null;
}) {
  if (error) {
    const message = ERROR_MESSAGES[error] ?? decodeURIComponent(error);
    return <div className="alert alert--danger" role="alert">{message}</div>;
  }
  if (merged) {
    const count = Number(merged);
    const label = Number.isFinite(count) && count > 0
      ? `${count} ${count === 1 ? "tutor mesclado" : "tutores mesclados"} com sucesso.`
      : "Tutores mesclados com sucesso.";
    return <div className="alert alert--success" role="status">{label}</div>;
  }
  if (mergedFrom) {
    return (
      <div className="alert alert--success" role="status">
        Este tutor foi mesclado em outro registro. Voce esta vendo o tutor canonico.
      </div>
    );
  }
  if (saved) {
    return <div className="alert alert--success" role="status">{SUCCESS_MESSAGES[saved] ?? "Alteracoes salvas com sucesso."}</div>;
  }
  if (deleted) {
    return <div className="alert alert--success" role="status">{SUCCESS_MESSAGES.deleted}</div>;
  }
  if (google) {
    return <div className="alert alert--success" role="status">{SUCCESS_MESSAGES[google] ?? "Conta Google atualizada."}</div>;
  }
  return null;
}

export type { FlashKind };
