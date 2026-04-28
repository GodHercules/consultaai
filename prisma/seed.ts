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

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@local").toLowerCase().trim();
  const name = process.env.ADMIN_NAME ?? "Administrador";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`[seed] ADMIN já existe: ${email}`);
    return;
  }

  const temporaryPassword = randomTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
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

  console.log(`[seed] ADMIN criado: ${email}`);
  console.log(`[seed] Senha temporária (válida 24h): ${temporaryPassword}`);
  console.log(
    `[seed] Dica: defina N8N_WEBHOOK_URL para enviar automaticamente por webhook.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

