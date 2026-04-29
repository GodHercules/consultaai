import { prisma } from "@/lib/prisma";
import { getSessionCookie } from "@/services/auth/cookies";
import { verifySession } from "@/services/auth/jwt";

export async function getSessionUser() {
  const token = await getSessionCookie();
  if (!token) return null;

  try {
    const session = await verifySession(token);
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
      },
    });
    if (!user || !user.isActive) return null;
    return { session, user };
  } catch {
    return null;
  }
}
