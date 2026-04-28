# Central de Clientes (MVP – Free Tier)

Sistema corporativo para substituir planilhas descentralizadas por uma fonte única da verdade: consulta avançada de empresas, gestão de usuários, auditoria e importação Excel.

## Stack (obrigatória)

- Next.js (App Router) + React Server Components
- TypeScript + TailwindCSS + shadcn/ui
- Prisma ORM + PostgreSQL (Supabase ou Neon)
- Deploy: Vercel (app) + Supabase/Neon (DB)

## Funcionalidades

- Autenticação: JWT em cookie `httpOnly` + `bcryptjs`
- Roles: `ADMIN` e `USER` (middleware por rota)
- Senha temporária: validade 24h + troca obrigatória no 1º login
- Reset de senha: token (2h) + limite 1 vez/dia + envio via webhook n8n
- Webhook n8n via `N8N_WEBHOOK_URL` com eventos:
  - `USER_CREATED`
  - `PASSWORD_TEMP`
  - `PASSWORD_RESET_REQUEST`
  - `PASSWORD_RESET_SUCCESS`
- Auditoria: login, importação, alterações e resets
- Empresas: consulta, detalhe, cadastro/edição (ADMIN), inativar/reativar (ADMIN)
- Importação Excel: `xlsx`, detecção automática de colunas, normalização, dedupe, upsert e relatório

## Setup local

1) Instale dependências:

```bash
npm i
```

2) Configure env:

- Copie `.env.example` para `.env`
- Preencha `DATABASE_URL` (Supabase/Neon)
- Gere `AUTH_JWT_SECRET` (>= 32 chars)
- (Opcional) `N8N_WEBHOOK_URL`

3) Rode migrations + seed:

```bash
npm run db:migrate
npx prisma db seed
```

O seed cria um `ADMIN` automaticamente. Você pode controlar o seed via:

- `ADMIN_EMAIL` (default: `admin@local`)
- `ADMIN_NAME` (default: `Administrador`)

4) Suba o servidor:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Fluxo de reset de senha (n8n)

O endpoint `POST /api/auth/forgot-password` gera um token e envia ao n8n no payload padrão:

```json
{
  "event": "",
  "email": "",
  "name": "",
  "temporaryPassword": "",
  "timestamp": ""
}
```

No n8n, envie este token ao usuário (por e-mail). Para finalizar, o usuário usa a tela `Redefinição de senha` e chama `POST /api/auth/reset-password`.

## Deploy (Vercel)

- Configure as env vars no projeto Vercel:
  - `DATABASE_URL`
  - `AUTH_JWT_SECRET`
  - `N8N_WEBHOOK_URL` (opcional)
  - `ADMIN_EMAIL` / `ADMIN_NAME` (opcional)
- Rode `prisma migrate deploy` (ex.: pipeline/build step) e execute seed 1 vez.

## Estrutura de pastas

- `app/` rotas (UI + Route Handlers)
- `components/` UI (shadcn + componentes de negócio)
- `lib/` prisma/env/rateLimit
- `services/` regras de negócio (auth, webhook, import, audit)
- `repositories/` queries e busca
- `prisma/` schema + seed
- `utils/` normalização (CNPJ/texto/crypto)
- `types/` tipos compartilhados

## Observações do Free Tier

- Use paginação e limites (aplicado nos endpoints e listagens principais)
- Evite queries pesadas e `include` profundos
- Índices em `cnpjNumerico`, `raizCnpj`, `grupoNormalizado`

