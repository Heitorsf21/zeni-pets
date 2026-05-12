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

## Como fazer deploy de uma nova feature

O Plano Hobby da Vercel não aceita commits de colaboradores externos — o deploy é sempre feito via **Vercel CLI** com o token da conta da Fernanda.

### Passo a passo

1. **Desenvolva e teste localmente** com Docker rodando:
   ```bash
   npm run db:docker:up
   npm run dev
   ```

2. **Copie as alterações** para o clone fora do OneDrive (o git dentro do OneDrive tem problemas com arquivos cloud-only):
   ```bash
   # Copiar src/ modificado:
   robocopy "c:\Users\heito\OneDrive\Área de Trabalho\ZENI PETS\src" "C:\Projects\zeni-pets\src" /E /XA:O
   # Copiar prisma/ se houve mudança de schema ou nova migration:
   robocopy "c:\Users\heito\OneDrive\Área de Trabalho\ZENI PETS\prisma" "C:\Projects\zeni-pets\prisma" /E /XA:O
   ```

3. **Commit e push** para o repo da Fernanda (onde a Vercel está conectada):
   ```bash
   git -C "C:\Projects\zeni-pets" add .
   git -C "C:\Projects\zeni-pets" commit -m "feat: descrição da feature"
   git -C "C:\Projects\zeni-pets" push zenipets main
   # Também manter o repo de dev atualizado:
   git -C "C:\Projects\zeni-pets" push origin main
   ```

4. **Deploy via Vercel CLI:**
   ```bash
   cd "C:\Projects\zeni-pets"
   vercel --prod --yes --token <VERCEL_TOKEN>
   ```
   > O token da Vercel é gerado em: vercel.com → Account Settings → Tokens.
   > Gerar um novo token se o anterior expirar ou for perdido (conta zeni.petss@gmail.com).

### Migrations de banco

Migrations rodam **automaticamente no build** (o script `build` inclui `prisma migrate deploy`). Para adicionar uma nova migration:

```bash
# No projeto OneDrive, localmente:
npx prisma migrate dev --name nome_da_migration
# Isso cria o arquivo em prisma/migrations/ — inclua no commit
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

## Clone de trabalho

O projeto fica em `c:\Users\heito\OneDrive\Área de Trabalho\ZENI PETS` (OneDrive).
O git dentro do OneDrive tem bugs com arquivos cloud-only — por isso existe um clone separado:

**Clone de produção:** `C:\Projects\zeni-pets`
- Remote `origin` → `Heitorsf21/zeni-pets` (repo dev)
- Remote `zenipets` → `zenipets/zeni-pets` (repo produção, onde Vercel escuta)

Para sincronizar tudo de uma vez do OneDrive para o clone:
```bash
robocopy "c:\Users\heito\OneDrive\Área de Trabalho\ZENI PETS\src" "C:\Projects\zeni-pets\src" /E /XA:O /NFL /NDL
robocopy "c:\Users\heito\OneDrive\Área de Trabalho\ZENI PETS\prisma" "C:\Projects\zeni-pets\prisma" /E /XA:O /NFL /NDL
robocopy "c:\Users\heito\OneDrive\Área de Trabalho\ZENI PETS\tests" "C:\Projects\zeni-pets\tests" /E /XA:O /NFL /NDL
robocopy "c:\Users\heito\OneDrive\Área de Trabalho\ZENI PETS\scripts" "C:\Projects\zeni-pets\scripts" /E /XA:O /NFL /NDL
Copy-Item "c:\Users\heito\OneDrive\Área de Trabalho\ZENI PETS\package.json" "C:\Projects\zeni-pets\package.json" -Force
```

## Variáveis de ambiente de produção

Gerenciadas no painel da Vercel:
https://vercel.com/zenipets-projects/zeni-pets/settings/environment-variables

Nunca commitar `.env` ou `.env.local` com valores reais — o `.gitignore` já protege esses arquivos.
