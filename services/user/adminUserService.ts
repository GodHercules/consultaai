import { prisma } from "@/lib/prisma";
import { auditLog } from "@/services/audit";
import { hashPassword } from "@/services/auth/password";
import { sendWebhookEvent } from "@/services/webhook";
import { randomToken } from "@/utils/crypto";

export async function createUserWithTemporaryPassword(input: {
  actorUserId: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  department?: "DP" | "FISCAL" | "CONTABIL" | null;
  isDepartmentLeader?: boolean;
}) {
  const email = input.email.toLowerCase().trim();
  const name = input.name.trim();
  const department = input.department ?? null;
  const isDepartmentLeader = input.isDepartmentLeader ?? false;

  if (isDepartmentLeader && (input.role !== "ADMIN" || !department)) {
    throw new Error("INVALID_DEPARTMENT_LEADER");
  }

  const temporaryPassword = randomToken(12);
  const passwordHash = await hashPassword(temporaryPassword);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: input.role,
      department,
      isDepartmentLeader,
      isActive: true,
      mustChangePassword: true,
      tempPassword: { create: { expiresAt } },
    },
    select: { id: true, name: true, email: true, role: true },
  });

  await auditLog({
    userId: input.actorUserId,
    action: "USER_CREATED",
    entity: "User",
    entityId: user.id,
    newValue: { email: user.email, role: user.role },
  });

  await sendWebhookEvent({
    event: "USER_CREATED",
    email: user.email,
    name: user.name,
  });
  await sendWebhookEvent({
    event: "PASSWORD_TEMP",
    email: user.email,
    name: user.name,
    temporaryPassword,
  });

  return { user, temporaryPassword };
}

export async function resetTemporaryPassword(input: {
  actorUserId: string;
  userId: string;
}) {
  const temporaryPassword = randomToken(12);
  const passwordHash = await hashPassword(temporaryPassword);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await prisma.user.update({
    where: { id: input.userId },
    data: {
      passwordHash,
      mustChangePassword: true,
      tempPassword: {
        upsert: { create: { expiresAt }, update: { expiresAt, createdAt: new Date() } },
      },
    },
    select: { id: true, email: true, name: true },
  });

  await auditLog({
    userId: input.actorUserId,
    action: "PASSWORD_TEMP_RESET",
    entity: "User",
    entityId: user.id,
  });

  await sendWebhookEvent({
    event: "PASSWORD_TEMP",
    email: user.email,
    name: user.name,
    temporaryPassword,
  });

  return { temporaryPassword };
}
