export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { setSessionCookie } from "@/services/auth/cookies";
import { signSession } from "@/services/auth/jwt";
import { verifyPassword } from "@/services/auth/password";
import { getClientIp } from "@/utils/request";

const schema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const ip = getClientIp(request.headers) ?? "unknown";

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const limiter = rateLimit({
    key: `login:${ip}:${parsed.data.email}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limiter.ok) {
    return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      passwordHash: true,
    },
  });

  const genericError = Response.json(
    { error: "INVALID_CREDENTIALS" },
    { status: 401 },
  );

  if (!user || !user.isActive) return genericError;

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return genericError;

  if (user.mustChangePassword) {
    const tmp = await prisma.userTempPassword.findUnique({
      where: { userId: user.id },
      select: { expiresAt: true },
    });
    if (tmp && tmp.expiresAt.getTime() < Date.now()) {
      return Response.json(
        { error: "TEMP_PASSWORD_EXPIRED" },
        { status: 403 },
      );
    }
  }

  const token = await signSession({
    sub: user.id,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  });
  await setSessionCookie(token);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "LOGIN_SUCCESS",
      entity: "User",
      entityId: user.id,
      newValue: { ip },
    },
  });

  return Response.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    mustChangePassword: user.mustChangePassword,
  });
}
