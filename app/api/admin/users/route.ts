export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { z } from "zod";
import { listUsers } from "@/repositories/userRepository";
import { requireAuth } from "@/services/auth/require";
import { createUserWithTemporaryPassword } from "@/services/user/adminUserService";

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["ADMIN", "USER"]),
});

export async function GET(request: Request) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "20");

  const result = await listUsers({ page, pageSize });
  return Response.json(result);
}

export async function POST(request: Request) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const result = await createUserWithTemporaryPassword({
    actorUserId: auth.session.user.id,
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
  });

  return Response.json({ user: result.user });
}

