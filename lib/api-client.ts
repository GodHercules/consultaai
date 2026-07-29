const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "") ?? "";

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${configuredApiUrl}${normalizedPath}`;
}

export function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  return fetch(apiUrl(input), {
    ...init,
    headers,
    credentials: "include",
  });
}
