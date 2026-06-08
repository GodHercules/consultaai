export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { sendWebhookEvent } from "@/services/webhook";
import { randomToken, sha256Base64Url } from "@/utils/crypto";
import { getClientIp } from "@/utils/request";

const schema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
});

export async function POST(request: Request) {
  const ip = getClientIp(request.headers) ?? "unknown";

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: true }, { status: 200 });
  }

  const limiter = await rateLimit({
    key: `forgot:${ip}:${parsed.data.email}`,
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!limiter.ok) {
    return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true, name: true, isActive: true },
  });

  // Resposta genérica para não vazar existência de usuário.
  if (!user || !user.isActive) return Response.json({ ok: true }, { status: 200 });

  const last = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < 24 * 60 * 60 * 1000) {
    return Response.json({ error: "RESET_LIMIT" }, { status: 429 });
  }

  const token = randomToken(32);
  const tokenHash = await sha256Base64Url(token);
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      requestIp: ip,
    },
  });

  await sendWebhookEvent({
    event: "PASSWORD_RESET_REQUEST",
    email: user.email,
    name: user.name,
    temporaryPassword: token,
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "PASSWORD_RESET_REQUEST",
      entity: "User",
      entityId: user.id,
      newValue: { ip },
    },
  });

  return Response.json({ ok: true }, { status: 200 });
}
