# ConsultaAI backend

Este diretório é o único serviço publicado no Render. Ele contém as rotas `/api`, o Prisma, as migrations e os serviços de banco.

Variáveis necessárias no Render:

- `DATABASE_URL`
- `AUTH_JWT_SECRET`
- `FRONTEND_ORIGIN` com a URL do projeto no Vercel

O `render.yaml` usa `rootDir: backend`, executa as migrations e inicia apenas este aplicativo Next.js de API.
