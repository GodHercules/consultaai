export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requireAuth } from "@/services/auth/require";

type Municipality = { id: number; nome: string };
const cache = new Map<string, { expiresAt: number; values: Municipality[] }>();
const validUf = /^[A-Z]{2}$/;

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const uf = new URL(request.url).searchParams.get("uf")?.trim().toUpperCase() ?? "";
  if (!validUf.test(uf)) return Response.json({ error: "INVALID_UF" }, { status: 400 });

  const cached = cache.get(uf);
  if (cached && cached.expiresAt > Date.now()) return Response.json({ municipalities: cached.values });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return Response.json({ error: "MUNICIPALITIES_UNAVAILABLE" }, { status: 503 });
    const raw = await response.json() as Array<{ id?: number; nome?: string }>;
    const values = raw
      .filter((item): item is { id: number; nome: string } => Number.isInteger(item.id) && Boolean(item.nome?.trim()))
      .map((item) => ({ id: item.id, nome: item.nome.trim() }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    cache.set(uf, { expiresAt: Date.now() + 24 * 60 * 60_000, values });
    return Response.json({ municipalities: values });
  } catch (error) {
    return Response.json({ error: error instanceof DOMException && error.name === "AbortError" ? "MUNICIPALITIES_TIMEOUT" : "MUNICIPALITIES_UNAVAILABLE" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
