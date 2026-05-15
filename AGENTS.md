<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Infraestrutura e Deploy

## Stack de produção

| Componente | Serviço | Conta |
|---|---|---|
| App (Next.js) | Vercel Hobby | zeni.petss@gmail.com |
| Banco de dados | Neon PostgreSQL | zeni.petss@gmail.com |
| Repo produção | github.com/zenipets/zeni-pets | zenipets (Heitorsf21 é colaborador) |
| Repo dev | github.com/Heitorsf21/zeni-pets | Heitorsf21 |

**URL de produção:** https://zeni-pets.vercel.app
**Login da Fernanda:** zeni.pets@gmail.com

## Workspace

O projeto vive em **`C:\Projects\zeni-pets`** (caminho local, fora do OneDrive). Todo trabalho — edição, testes, commits e push — acontece nessa pasta.

Remotes configurados:
- `origin` → `Heitorsf21/zeni-pets` (repo dev)
- `zenipets` → `zenipets/zeni-pets` (repo produção, onde a Vercel escuta)

> Versão anterior do projeto morava em `c:\Users\heito\OneDrive\Área de Trabalho\ZENI PETS` e era espelhada para o clone via robocopy. Esse fluxo foi abandonado em 2026-05-15 porque o git dentro do OneDrive falha com arquivos cloud-only. Se a pasta antiga ainda existir, pode ser removida.

## Como fazer deploy

A Vercel está conectada ao repo `zenipets/zeni-pets` e faz **deploy automático** a cada push em `main`. Não precisa de Vercel CLI nem de token.

```bash
git add .
git commit -m "feat: descrição da feature"
git push zenipets main   # dispara o build na Vercel
git push origin main     # mantém o repo de dev sincronizado
```

Acompanhe o build em https://vercel.com/zenipets-projects/zeni-pets/deployments. Produção: https://zeni-pets.vercel.app.

### Migrations de banco

Migrations rodam **automaticamente no build** (o script `build` inclui `prisma migrate deploy`). Para adicionar uma nova migration:

```bash
npx prisma migrate dev --name nome_da_migration
# Cria o arquivo em prisma/migrations/ — inclua no commit
```

## Ambiente local de desenvolvimento

```bash
npm run db:docker:up   # Sobe PostgreSQL local (Docker, porta 55432)
npm run dev            # Servidor Next.js em localhost:3000
npm run db:docker:down # Para o banco local
```

O banco local usa:
- Host: `localhost:55432`
- User/pass: `zeni / zeni`
- Database: `zeni_pets`

## Variáveis de ambiente

- **Produção:** gerenciadas no painel da Vercel — https://vercel.com/zenipets-projects/zeni-pets/settings/environment-variables
- **Local:** `.env` em `C:\Projects\zeni-pets\.env` (gitignored — nunca commitar)
