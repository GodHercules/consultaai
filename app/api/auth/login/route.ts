export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { createPrismaClient, prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";
import { setSessionCookie } from "@/services/auth/cookies";
import { passwordChecksumFromHash, signSession } from "@/services/auth/jwt";
import { hashPassword, verifyPassword } from "@/services/auth/password";
import {
  isTestAdminEmail,
  normalizeTestAdminEmail,
  TEST_ADMIN_CANONICAL_EMAIL,
  TEST_ADMIN_DEFAULT_PASSWORD,
} from "@/services/auth/testAdmin";
import { getClientIp } from "@/utils/request";
import { randomToken } from "@/utils/crypto";

const schema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

function isTransientConnectionError(error: unknown) {
  const message = error instanceof Error ? `${error.message} ${error.name}` : String(error);
  return message.includes("P1017") || message.includes("ConnectionClosed") || message.includes("Connection terminated unexpectedly") || message.includes("Server has closed the connection");
}

async function retryTransient<T>(operation: () => Promise<T>, attempts = 5) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientConnectionError(error) || attempt === attempts - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }

  throw lastError ?? new Error("Unknown transient error");
}

async function withFreshPrisma<T>(operation: (client: ReturnType<typeof createPrismaClient>) => Promise<T>) {
  try {
    return await retryTransient(() => operation(prisma));
  } catch (error) {
    if (!isTransientConnectionError(error)) {
      throw error;
    }

    const freshPrisma = createPrismaClient();
    try {
      return await retryTransient(() => operation(freshPrisma));
    } finally {
      await freshPrisma.$disconnect().catch(() => undefined);
    }
  }
}

export async function POST(request: Request) {
  const ip = getClientIp(request.headers) ?? "unknown";
  const url = new URL(request.url);
  const redirectMode = url.searchParams.get("redirect") === "1";
  const next = url.searchParams.get("next");
  const contentType = request.headers.get("content-type") ?? "";

  function redirectTo(path: string) {
    return new Response(null, {
      status: 303,
      headers: { Location: path },
    });
  }

  function authError(error: string, status: number) {
    if (!redirectMode) {
      return Response.json({ error }, { status });
    }

    const target = new URLSearchParams();
    target.set("error", error);
    if (next) target.set("next", next);
    return redirectTo(`/login?${target.toString()}`);
  }

  let body: unknown = null;
  if (contentType.includes("application/json")) {
    body = await request.json().catch(() => null);
  } else if (contentType.includes("form")) {
    const formData = await request.formData();
    body = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    };
  } else {
    body = await request.json().catch(() => null);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return authError("INVALID_INPUT", 400);
  }

  const defaultEnabled = (process.env.ENABLE_DEFAULT_TEST_ADMIN ?? "true").toLowerCase() !== "false";
  const defaultName = (process.env.DEFAULT_TEST_ADMIN_NAME ?? "Administrador de Teste").trim();
  const defaultPassword = TEST_ADMIN_DEFAULT_PASSWORD;
  const loginEmail = normalizeTestAdminEmail(parsed.data.email);

  const limiter = await rateLimit({
    key: `login:${ip}:${loginEmail}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!limiter.ok) {
    return authError("RATE_LIMITED", 429);
  }

  const user = await withFreshPrisma((db) =>
    db.user.findUnique({
      where: { email: loginEmail },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        passwordHash: true,
      },
    })
  );

  const genericError = authError("INVALID_CREDENTIALS", 401);

  if (user && user.isActive) {
    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) return genericError;

    if (user.mustChangePassword) {
      const tmp = await withFreshPrisma((db) =>
        db.userTempPassword.findUnique({
          where: { userId: user.id },
          select: { expiresAt: true },
        })
      );
      if (!tmp || tmp.expiresAt.getTime() < Date.now()) {
        const revokedHash = await hashPassword(randomToken(32));
        await withFreshPrisma((db) =>
          db.$transaction([
            db.user.update({
              where: { id: user.id },
              data: { passwordHash: revokedHash, mustChangePassword: false },
            }),
            db.userTempPassword.deleteMany({ where: { userId: user.id } }),
          ])
        );
        return authError("TEMP_PASSWORD_EXPIRED", 403);
      }
    }

    const passwordChecksum = await passwordChecksumFromHash(user.passwordHash);
    const token = await signSession({
      sub: user.id,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      passwordChecksum,
    });
    await setSessionCookie(token);

    try {
      await withFreshPrisma((db) =>
        db.auditLog.create({
          data: {
            userId: user.id,
            action: "LOGIN_SUCCESS",
            entity: "User",
            entityId: user.id,
            newValue: { ip },
          },
        })
      );
    } catch (error) {
      console.error("Failed to record login audit log", error);
    }

    if (redirectMode) {
      const destination = next && next !== "/" ? next : user.role === "ADMIN" ? "/dashboard" : "/companies";
      return redirectTo(destination);
    }

    return Response.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      mustChangePassword: user.mustChangePassword,
    });
  }

  if (defaultEnabled && isTestAdminEmail(parsed.data.email) && parsed.data.password === defaultPassword) {
    const token = await signSession({
      sub: TEST_ADMIN_CANONICAL_EMAIL,
      role: "ADMIN",
      mustChangePassword: false,
      passwordChecksum: "bootstrap-default-admin",
      email: loginEmail,
      name: defaultName,
      bootstrap: true,
    });
    await setSessionCookie(token);

    if (redirectMode) {
      const destination = next && next !== "/" ? next : "/dashboard";
      return redirectTo(destination);
    }

    return Response.json({
      user: { id: TEST_ADMIN_CANONICAL_EMAIL, name: defaultName, email: loginEmail, role: "ADMIN" },
      mustChangePassword: false,
    });
  }

  return genericError;
}
