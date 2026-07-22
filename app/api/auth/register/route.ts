import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { auditLog } from "@/services/audit";
import { hashPassword, validateNewPassword } from "@/services/auth/password";
import { getClientIp } from "@/utils/request";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().email().transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1),
  confirmPassword: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  if (parsed.data.password !== parsed.data.confirmPassword) {
    return Response.json({ error: "PASSWORDS_DO_NOT_MATCH" }, { status: 400 });
  }

  if (validateNewPassword(parsed.data.password)) {
    return Response.json({ error: "WEAK_PASSWORD" }, { status: 400 });
  }

  const ip = getClientIp(request.headers) ?? "unknown";
  const limiter = await rateLimit({
    key: `register:${ip}:${parsed.data.email}`,
    limit: 5,
    windowMs: 15 * 60 * 1000,
  });
  if (!limiter.ok) {
    return Response.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        role: "USER",
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    await auditLog({
      userId: user.id,
      action: "USER_REGISTERED",
      entity: "User",
      entityId: user.id,
      newValue: { email: user.email, role: user.role, ip },
    });

    return Response.json({ user }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return Response.json({ error: "EMAIL_ALREADY_EXISTS" }, { status: 409 });
    }

    console.error("Public user registration failed", error);
    return Response.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }
}
