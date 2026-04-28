export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/services/auth/session";
import { signSession } from "@/services/auth/jwt";
import { setSessionCookie } from "@/services/auth/cookies";
import {
  hashPassword,
  validateNewPassword,
  verifyPassword,
} from "@/services/auth/password";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true, mustChangePassword: true, role: true },
  });
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return Response.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });

  const err = validateNewPassword(parsed.data.newPassword);
  if (err) return Response.json({ error: "WEAK_PASSWORD", message: err }, { status: 400 });

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.userTempPassword.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PASSWORD_CHANGED",
        entity: "User",
        entityId: user.id,
      },
    }),
  ]);

  const newToken = await signSession({
    sub: user.id,
    role: user.role,
    mustChangePassword: false,
  });
  setSessionCookie(newToken);

  return Response.json({ ok: true });
}

