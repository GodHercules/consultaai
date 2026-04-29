import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

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

async function main() {
  const emailsRaw =
    process.env.ADMIN_EMAILS ??
    process.env.ADMIN_EMAIL ??
    "admin1@local,admin2@local,admin3@local";
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

