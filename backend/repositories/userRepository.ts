import { prisma } from "@/lib/prisma";

export async function listUsers(params: { page: number; pageSize: number }) {
  const pageSize = Math.min(Math.max(params.pageSize, 1), 50);
  const page = Math.max(params.page, 1);
  const skip = (page - 1) * pageSize;

  const [total, items] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        isDepartmentLeader: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  return { total, page, pageSize, items };
}
