# Contexto do Projeto Zeni Pets

## Status atual

- Projeto ativo.
- Cliente: Fernanda Zeni.
- Empresa: Zeni Pets.
- Tipo de negocio: pet sitter e hotelzinho para cachorros.
- Fernanda aceitou o projeto na reuniao de alinhamento.
- Heitor ja realizou uma reuniao de diagnostico da operacao.
- Heitor tambem ja gerou um modelo visual inicial para a interface.
- Existem planilhas com:
  - Dados de clientes.
  - Valores cobrados.
  - Informacoes usadas pela Fernanda no dia a dia.

## Objetivo do projeto

Criar um sistema web interno para facilitar a operacao diaria da Zeni Pets.

O sistema deve ajudar Fernanda a organizar:

- Clientes/tutores.
- Pets.
- Agenda.
- Reservas/servicos.
- Pagamentos.
- Controle financeiro basico.
- Informacoes importantes usadas na rotina.

O objetivo nao e substituir o atendimento direto dela com os clientes. A primeira versao sera um sistema interno, de bastidor.

## Condicoes comerciais combinadas

- Projeto-piloto no valor de R$300.
- Heitor oferecera o sistema funcional por 1 ano usando sua estrutura atual de VPS e dominio.
- Neste primeiro ano, nao havera cobranca adicional de dominio/VPS.
- Apos 1 ano, caso Fernanda queira continuar usando o sistema, sera combinado apenas um valor justo para manter o sistema no ar e garantir manutencao basica.
- O projeto podera ser usado como case de portfolio, com telas sem dados reais e depoimento se o resultado for aprovado pela cliente.
- O projeto sera assinado como Heitor Fernandes.

## Escopo inicial do MVP

### Incluido

- Dashboard com resumo do dia.
- Proximos servicos/reservas.
- Valores pendentes.
- Faturamento ou receitas do mes.
- Cadastro de clientes/tutores.
- Cadastro de pets vinculados aos tutores.
- Agenda/reservas com data, horario, tipo de servico, status, valor e pagamento.
- Financeiro basico com receitas, pendencias, despesas simples e relatorio mensal.
- Configuracoes basicas de servicos, valores e dados da empresa.

### Fora da primeira versao

- Agenda publica para clientes.
- Portal do cliente.
- Aplicativo mobile nativo.
- Gateway de pagamento.
- Emissao fiscal.
- Integracao bancaria.
- Gestao completa de anuncios do Instagram.
- Automacoes complexas de WhatsApp.
- Migracao em massa de historico antigo, salvo combinacao posterior.

## Status previstos

### Reserva

- solicitada
- confirmada
- em_andamento
- concluida
- cancelada

### Pagamento

- pendente
- parcial
- pago

### Cliente

- ativo
- inativo

## Direcao tecnica planejada

- Sistema web.
- Next.js + TypeScript.
- UI moderna, simples e profissional.
- Banco PostgreSQL.
- ORM Prisma.
- Deploy em VPS propria.
- Docker para empacotar a aplicacao.
- Nginx ou Caddy para dominio/subdominio e HTTPS.
- Login interno com usuario e senha para Fernanda.

## Materiais ja gerados no Codex

Os materiais abaixo foram gerados antes da pasta do projeto ser definida:

- Proposta inicial de conversa:
  - `C:\Users\heito\Documents\Codex\2026-04-27\eu-sou-heitor-fernandes-e-quero\zeni-pets-proposta\output\output.pptx`
- Proposta comercial:
  - `C:\Users\heito\Documents\Codex\2026-04-27\eu-sou-heitor-fernandes-e-quero\zeni-pets-proposta-comercial\output\output.pptx`
- Mensagem inicial para Fernanda:
  - `C:\Users\heito\Documents\Codex\2026-04-27\eu-sou-heitor-fernandes-e-quero\mensagem-fernanda-zeni.md`

## Proximo trabalho recomendado

1. Organizar dentro desta pasta todos os arquivos do diagnostico:
   - Planilhas de clientes.
   - Planilhas de valores.
   - Informacoes da rotina.
   - Modelo visual da interface.
   - Anotacoes da reuniao.
2. Ler as planilhas e extrair os campos reais usados pela operacao.
3. Transformar o diagnostico em especificacao do MVP.
4. Criar modelo de dados:
   - Cliente/tutor.
   - Pet.
   - Reserva/servico.
   - Pagamento.
   - Despesa.
   - Configuracoes.
5. Criar backlog de desenvolvimento.
6. Iniciar implementacao do sistema.

## Principio do projeto

Este projeto deve ser simples o bastante para ser entregue bem, mas profissional o suficiente para virar case real.

Prioridade:

- Resolver a rotina real da Fernanda.
- Evitar overengineering.
- Proteger o escopo.
- Criar uma base que possa evoluir depois.
