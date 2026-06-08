import { cache } from "react";
import type { Department, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionCookie } from "@/services/auth/cookies";
import { passwordChecksumFromHash, verifySession } from "@/services/auth/jwt";
import { isTestAdminEmail, TEST_ADMIN_DISPLAY_EMAIL } from "@/services/auth/testAdmin";

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: Department | null;
  isDepartmentLeader: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordHash: string;
  tempPassword: { expiresAt: Date } | null;
};

type SessionResult = {
  session: Awaited<ReturnType<typeof verifySession>>;
  user: SessionUser;
} | null;

export const getSessionUser = cache(async function getSessionUser(): Promise<SessionResult> {
  const token = await getSessionCookie();
  if (!token) return null;

  try {
    const session = await verifySession(token);

    const defaultEnabled = (process.env.ENABLE_DEFAULT_TEST_ADMIN ?? "true").toLowerCase() !== "false";
    const defaultName = (process.env.DEFAULT_TEST_ADMIN_NAME ?? "Administrador de Teste").trim();
    if (session.bootstrap && defaultEnabled && session.email && isTestAdminEmail(session.email)) {
      const user = {
        id: session.sub,
        name: session.name ?? defaultName,
        email: session.email ?? TEST_ADMIN_DISPLAY_EMAIL,
        role: session.role,
        department: null,
        isDepartmentLeader: false,
        isActive: true,
        mustChangePassword: false,
        passwordHash: "",
        tempPassword: null,
      };
      return { session, user };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isDepartmentLeader: true,
        isActive: true,
        mustChangePassword: true,
        passwordHash: true,
        tempPassword: { select: { expiresAt: true } },
      },
    });
    if (!user || !user.isActive) return null;
    if (session.passwordChecksum !== (await passwordChecksumFromHash(user.passwordHash))) {
      return null;
    }
    if (user.mustChangePassword) {
      const expiresAt = user.tempPassword?.expiresAt;
      if (!expiresAt || expiresAt.getTime() < Date.now()) {
        return null;
      }
    }
    return { session, user };
  } catch {
    return null;
  }
});
