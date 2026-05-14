# Central de Clientes (MVP – Free Tier)

Sistema corporativo para substituir planilhas descentralizadas por uma fonte única da verdade: consulta avançada de empresas, gestão de usuários, auditoria e importação Excel.

## Stack (obrigatória)

- Next.js (App Router) + React Server Components
- TypeScript + TailwindCSS + shadcn/ui
- Prisma ORM + PostgreSQL (Supabase/Neon/Prisma Postgres)
- Deploy: Vercel (app) + Supabase/Neon/Prisma Postgres (DB)

## Funcionalidades

- Autenticação: JWT em cookie `httpOnly` + `bcryptjs`
- Roles: `ADMIN` e `USER` (middleware por rota)
- Setores (usuários): `DP`, `FISCAL`, `CONTABIL` + líder do setor (exibido no Perfil)
- Senha temporária: validade 24h + troca obrigatória no 1º login
- Reset de senha: token (2h) + limite 1 vez/dia + envio via webhook n8n
- Webhook n8n via `N8N_WEBHOOK_URL` com eventos:
  - `USER_CREATED`
  - `PASSWORD_TEMP`
  - `PASSWORD_RESET_REQUEST`
  - `PASSWORD_RESET_SUCCESS`
- Empresas: consulta, detalhe, cadastro/edição (ADMIN), inativar/reativar (ADMIN)
- Webhook FundarMF: recebimento seguro de empresas em fila pendente (ADMIN cadastra/aprova)
- Andamentos (Contábil): envio por empresa + visão consolidada (ADMIN) tipo timeline/Gantt (MVP)
- Importação Excel: `xlsx`, detecção automática de colunas, normalização, dedupe, upsert e relatório

## Setup local

1) Instale dependências:

```bash
npm i
```

2) Configure env:

- Copie `.env.example` para `.env`
- Preencha `DATABASE_URL`
- Gere `AUTH_JWT_SECRET` (>= 32 chars)
- (Opcional) `N8N_WEBHOOK_URL`
- (Opcional) `FUNDARMF_WEBHOOK_SECRET` (para receber empresas via webhook)

3) Rode migrations + seed:

```bash
npm run db:migrate
npx prisma db seed
```

O seed cria até 3 `ADMIN` por padrão. Você pode controlar via:

- `ADMIN_EMAILS` (default: `admin1@local.com,admin2@local.com,admin3@local.com`)
- `ADMIN_NAMES` (default: `Administrador 1,Administrador 2,Administrador 3`)

Além disso, o seed garante 1 admin fixo para testes (sempre criado/atualizado):

- `DEFAULT_TEST_ADMIN_EMAIL` (default: `teste.admin@local.com`)
- `DEFAULT_TEST_ADMIN_PASSWORD` (default: `Teste@123456`)
- `DEFAULT_TEST_ADMIN_NAME` (default: `Administrador de Teste`)
- `ENABLE_DEFAULT_TEST_ADMIN` (default: `true`)

4) Suba o servidor:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Webhook FundarMF (seguro)

Endpoint:

- `POST /api/webhooks/fundarmf`

Headers obrigatórios:

- `x-fundarmf-timestamp`: epoch ms (ex.: `1714416000000`)
- `x-fundarmf-signature`: `v1=<hex>`

Assinatura:

- message: `${timestamp}.${rawBody}`
- HMAC-SHA256 com `FUNDARMF_WEBHOOK_SECRET`

Após receber, o sistema cria um registro em `PendingCompany` (status `PENDING`). Admins fazem o cadastro em:

- `/admin/pending-companies`

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
  - `FUNDARMF_WEBHOOK_SECRET` (opcional)
  - `ADMIN_EMAILS` / `ADMIN_NAMES` (opcional)
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
