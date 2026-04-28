export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendWebhookEvent } from "@/services/webhook";
import { hashPassword, validateNewPassword } from "@/services/auth/password";
import { sha256Base64Url } from "@/utils/crypto";

const schema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const err = validateNewPassword(parsed.data.newPassword);
  if (err) return Response.json({ error: "WEAK_PASSWORD", message: err }, { status: 400 });

  const tokenHash = await sha256Base64Url(parsed.data.token);
  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, isActive: true } },
    },
  });

  if (!record || !record.user.isActive) {
    return Response.json({ error: "INVALID_TOKEN" }, { status: 400 });
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return Response.json({ error: "TOKEN_EXPIRED" }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.userTempPassword.deleteMany({ where: { userId: record.user.id } }),
    prisma.auditLog.create({
      data: {
        userId: record.user.id,
        action: "PASSWORD_RESET_SUCCESS",
        entity: "User",
        entityId: record.user.id,
      },
    }),
  ]);

  await sendWebhookEvent({
    event: "PASSWORD_RESET_SUCCESS",
    email: record.user.email,
    name: record.user.name,
  });

  return Response.json({ ok: true });
}

