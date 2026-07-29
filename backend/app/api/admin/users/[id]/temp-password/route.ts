export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAuth } from "@/services/auth/require";
import { resetTemporaryPassword } from "@/services/user/adminUserService";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth({ role: "ADMIN" });
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  await resetTemporaryPassword({
    actorUserId: auth.session.user.id,
    userId: id,
  });

  // Segurança: não retorna a senha temporária (vai por webhook).
  return Response.json({ ok: true, note: "Senha temporária enviada via webhook." });
}
