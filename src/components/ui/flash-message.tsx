const ERROR_MESSAGES: Record<string, string> = {
  "tutor-com-reservas": "Tutor possui reservas vinculadas. Inative em vez de excluir.",
  "pet-em-reservas": "Pet possui reservas vinculadas e nao pode ser removido.",
  "reserva-nao-removivel": "So e possivel excluir reservas com status pendente ou cancelada.",
  "reserva-nao-encontrada": "Reserva nao encontrada.",
  "lancamento-automatico": "Lancamentos automaticos vinculados a reservas nao podem ser removidos aqui.",
  "lancamento-nao-encontrado": "Lancamento nao encontrado.",
  "valor-invalido": "Informe um valor valido.",
  "valor-base-invalido": "Valor base invalido. Use formato 200,00.",
  "datas-invalidas": "A data de check-out deve ser posterior ao check-in.",
  "pets-do-tutor": "Selecione apenas pets do tutor escolhido.",
  "dados-obrigatorios": "Preencha todos os campos obrigatorios.",
  "dados-invalidos": "Verifique os dados informados.",
  "nome-obrigatorio": "Informe o nome.",
  "calendario-obrigatorio": "Informe o ID do calendario.",
  "google-nao-conectado": "Conecte uma conta Google antes de salvar o calendario.",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  "1": "Alteracoes salvas com sucesso.",
  saved: "Alteracoes salvas com sucesso.",
  deleted: "Registro removido.",
  connected: "Conta Google conectada.",
  "calendar-saved": "Calendario salvo.",
  "sync-complete": "Sincronizacao com Google Agenda concluida.",
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
