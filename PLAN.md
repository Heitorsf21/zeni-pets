# Plano Revisado Do MVP Zeni Pets

## Resumo

Construir o sistema interno da Zeni Pets com Next.js + TypeScript + PostgreSQL + Prisma, seguindo fielmente o visual do Claude Design enviado. A base visual do dashboard será a **Dashboard v1**, não a v2.

O MVP começa com operação limpa, mas já terá estrutura preparada para importar futuramente os dados antigos das planilhas e do relatório/Form/DOCX por uma camada de revisão antes de gravar nas tabelas finais.

## Implementação Principal

- Rotas: login, Dashboard v1, Agenda, Nova Reserva, Tutores, Pets, Financeiro e Configurações.
- Visual: recriar o design do Claude como objetivo final, usando `styles.css`, `shared.jsx` e `screens/dashboard-v1.jsx` como referência de layout, cores, cards, tabelas, badges, sidebar, topbar e espaçamentos.
- Usar `lucide-react` no lugar dos ícones inline, mantendo aparência equivalente.
- Dashboard v1: cards de métricas, pets hospedados hoje, próximos serviços, capacidade, faturamento, valores a receber e tarefas operacionais.
- Modelos principais: `User`, `Tutor`, `Pet`, `ServiceType`, `ServicePriceRule`, `SeasonPeriod`, `Reservation`, `ReservationPet`, `Payment`, `FinancialEntry`, `BusinessSettings`.
- Cobrança: toda reserva sugere 50% de sinal + saldo no encerramento, editável.
- Atraso automático: R$10/h para 1 pet; R$15/h total para 2+ pets, arredondando hora iniciada para cima.
- Taxi pet: cobrar só quando `pickupMode = Zeni retira na casa do cliente`; tutor entregando em mãos não gera taxa.

## Google Agenda

- Implementar sincronização dupla com Google Calendar.
- Configurações deve permitir conectar conta Google via OAuth, listar calendários e escolher depois qual calendário será usado.
- Reservas criadas/editadas/canceladas no sistema criam/atualizam/cancelam eventos no Google.
- Alterações feitas no Google voltam para o sistema apenas para campos de agenda: data/hora, título básico e cancelamento.
- Dados de negócio seguem pertencendo ao sistema: valores, pagamentos, tutor, pets, ficha, financeiro e observações sensíveis.
- Webhook Google deve apenas disparar sincronização; o sistema busca mudanças via sync token.
- Usar `extendedProperties.private` com `zeniReservationId`.
- Guardar `googleCalendarId`, `googleEventId`, `googleEventEtag`, `googleSyncToken`, `googleChannelId`, `googleResourceId`, `googleChannelExpiresAt`.
- Convite ao tutor será opcional por reserva; padrão é não enviar.
- Escopos previstos: `calendar.events` e `calendar.calendarlist.readonly`.

## Mapeamento Para Importação Futura

- Criar `ImportBatch` e `ImportRecord` com arquivo, aba, linha, payload cru, tipo detectado, confiança e status de revisão.
- `Planilha Valores 2026.xlsx`: preços e deslocamento viram staging para `ServiceType`, `ServicePriceRule` e regras de taxi pet.
- `Clientes 2025/2026`: staging de reservas históricas com tutor, serviço, data, pets, valor e pagamento.
- `Creche 2025/26`: staging de reservas de creche com horário; horários incompletos ficam pendentes.
- Abas mensais financeiras: `Categoria`, `Data`, `Valor` viram staging de `FinancialEntry`; totais manuais não entram.
- DOCX/Form de clientes: extrair tutor, CPF/RG, contato, endereço, pets, raça/idade/castrado, alimentação, saúde, veterinário, itens e observações.
- Nada antigo entra direto no banco final; tudo passa por revisão.

## Testes

- Unit tests: sinal, saldo, atraso, taxi pet, alta temporada, descontos e adicionais.
- Testes de importação: preços, reservas históricas, creche, financeiro mensal e DOCX/Form.
- Testes Google: criar evento, atualizar, cancelar, receber webhook, aplicar sync token e tratar conflito.
- E2E: login, criar tutor/pet, criar reserva com dois pets, sincronizar Google, registrar sinal, concluir com atraso e validar financeiro.
- Verificação visual com browser comparando as telas principais ao design Claude, especialmente Dashboard v1.

## Assumptions

- Dashboard v1 é a referência visual oficial.
- Sincronização dupla vale para agenda, não para dados financeiros ou ficha dos pets.
- Em conflito entre Google e sistema, marcar `syncConflict` para revisão.
- Importação antiga será posterior, mas a arquitetura de staging entra desde o início.
- Referências oficiais: [Google Calendar scopes](https://developers.google.com/workspace/calendar/api/auth), [Events insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert), [sync](https://developers.google.com/workspace/calendar/api/guides/sync), [push notifications](https://developers.google.com/workspace/calendar/api/guides/push).
