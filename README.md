# Zeni Pets - MVP interno

Aplicacao Next.js + TypeScript + Prisma + PostgreSQL para operacao interna da Zeni Pets.

## Rodar localmente

```powershell
npm.cmd install
docker compose up -d
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

Se a porta 3000 ja estiver ocupada:

```powershell
npx.cmd next dev --port 3100
```

Login local:

- Usuario: `fernanda@zenipets.local`
- Senha: `zeni123`

## Scripts

- `npm.cmd run lint` - ESLint.
- `npm.cmd run test` - unitarios de regras, importacao e Google Calendar.
- `npm.cmd run test:e2e` - smoke Playwright em `127.0.0.1:3100`.
- `npm.cmd run build` - Prisma generate + build Next.js.
- `npm.cmd run import:preview` - leitura das planilhas/DOCX para staging em memoria.
- `npm.cmd run db:seed` - seed inicial e staging dos diagnosticos no banco.

## Ambiente

Copie `.env.example` para `.env` e ajuste:

- `DATABASE_URL`
- `AUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_WEBHOOK_URL`
- `TOKEN_ENCRYPTION_KEY`

Observacao: no ambiente onde o projeto foi scaffoldado, `docker` e `psql` nao estavam no PATH. O arquivo `docker-compose.yml` ja esta pronto, mas o Docker precisa estar instalado/ativo para migrar e popular o PostgreSQL local.

## Escopo preservado

Os arquivos de diagnostico originais ficam na raiz e nao sao importados diretamente para tabelas finais. O seed cria registros em `ImportBatch` e `ImportRecord` para revisao posterior.
