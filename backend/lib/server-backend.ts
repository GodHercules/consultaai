import { headers } from "next/headers";

function apiBaseUrl(requestHeaders: Headers) {
  const configured = process.env.BACKEND_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") || "http";
  if (!host) throw new Error("BACKEND_URL is required when no request host is available.");
  return `${protocol}://${host}`;
}

export async function backendFetch(path: string, init: RequestInit = {}) {
  const requestHeaders = await headers();
  const outgoingHeaders = new Headers(init.headers);
  const cookie = requestHeaders.get("cookie");
  if (cookie) outgoingHeaders.set("cookie", cookie);
  if (!outgoingHeaders.has("Accept")) outgoingHeaders.set("Accept", "application/json");

  return fetch(`${apiBaseUrl(requestHeaders)}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers: outgoingHeaders,
    cache: "no-store",
  });
}

export async function getBackendSession() {
  const response = await backendFetch("/api/auth/me");
  if (!response.ok) return null;
  const data = (await response.json().catch(() => null)) as { user?: unknown } | null;
  return data?.user ?? null;
}
