import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

function prismaClientOptions() {
  const url = process.env.DATABASE_URL;
  const accelerateUrl = process.env.PRISMA_ACCELERATE_URL ?? undefined;
  const isPostgresDirect = Boolean(url && (url.startsWith("postgresql://") || url.startsWith("postgres://")));
  const isPrismaPostgres = Boolean(url && url.startsWith("prisma+postgres://"));
  const isPrismaAccelerate = Boolean(url && url.startsWith("prisma://"));

  if (!url) {
    throw new Error("DATABASE_URL is required to run the seed.");
  }

  if (accelerateUrl) {
    return { accelerateUrl } as ConstructorParameters<typeof PrismaClient>[0];
  }

  if (isPrismaPostgres || isPrismaAccelerate) {
    return { accelerateUrl: url } as ConstructorParameters<typeof PrismaClient>[0];
  }

  if (isPostgresDirect) {
    return {
      adapter: new PrismaPg({ connectionString: url }),
    } as ConstructorParameters<typeof PrismaClient>[0];
  }

  return {} as ConstructorParameters<typeof PrismaClient>[0];
}

const prisma = new PrismaClient({
  ...prismaClientOptions(),
});

function nowIso() {
  return new Date().toISOString();
}

function randomTemporaryPassword(length = 14) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function postWebhook(payload: Record<string, unknown>) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function createAdminUser(input: { email: string; name: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    console.log(`[seed] ADMIN já existe: ${input.email}`);
    return;
  }

  const temporaryPassword = randomTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: true,
    },
  });

  await prisma.userTempPassword.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    update: {
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    },
  });

  await postWebhook({
    event: "USER_CREATED",
    email: user.email,
    name: user.name,
    temporaryPassword: "",
    timestamp: nowIso(),
  });

  await postWebhook({
    event: "PASSWORD_TEMP",
    email: user.email,
    name: user.name,
    temporaryPassword,
    timestamp: nowIso(),
  });

  console.log(`[seed] ADMIN criado: ${input.email}`);
  console.log(`[seed] Senha temporária (válida 24h): ${temporaryPassword}`);
}

async function upsertDefaultTestAdmin() {
  const enabled = (process.env.ENABLE_DEFAULT_TEST_ADMIN ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    console.log("[seed] Admin padrão de teste desativado (ENABLE_DEFAULT_TEST_ADMIN=false).");
    return;
  }

  const email = (
    process.env.DEFAULT_TEST_ADMIN_EMAIL ?? "teste.admin@local.com"
  ).toLowerCase().trim();
  const name = (process.env.DEFAULT_TEST_ADMIN_NAME ?? "Administrador de Teste").trim();
  const plainPassword = process.env.DEFAULT_TEST_ADMIN_PASSWORD ?? "Teste@123456";

  if (!email || !plainPassword) {
    console.log("[seed] DEFAULT_TEST_ADMIN_EMAIL/DEFAULT_TEST_ADMIN_PASSWORD inválidos.");
    return;
  }

  const passwordHash = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      name,
      email,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
    update: {
      name,
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      mustChangePassword: false,
    },
  });

  await prisma.userTempPassword.deleteMany({ where: { userId: user.id } });

  console.log(`[seed] Admin padrão de teste pronto: ${email}`);
}

async function main() {
  await upsertDefaultTestAdmin();

  const emailsRaw =
    process.env.ADMIN_EMAILS ??
    process.env.ADMIN_EMAIL ??
    "admin1@local.com,admin2@local.com,admin3@local.com";
  const namesRaw =
    process.env.ADMIN_NAMES ??
    process.env.ADMIN_NAME ??
    "Administrador 1,Administrador 2,Administrador 3";

  const emails = emailsRaw
    .split(",")
    .map((v) => v.toLowerCase().trim())
    .filter(Boolean)
    .slice(0, 3);

  const names = namesRaw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (!emails.length) {
    console.log("[seed] Nenhum ADMIN_EMAILS encontrado.");
    return;
  }

  for (let i = 0; i < emails.length; i++) {
    await createAdminUser({
      email: emails[i],
      name: names[i] ?? `Administrador ${i + 1}`,
    });
  }

  console.log("[seed] Dica: defina N8N_WEBHOOK_URL para enviar automaticamente por webhook.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
