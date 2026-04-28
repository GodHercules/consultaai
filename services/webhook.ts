import { env } from "@/lib/env";

export type WebhookEvent =
  | "USER_CREATED"
  | "PASSWORD_TEMP"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET_SUCCESS";

export async function sendWebhookEvent(input: {
  event: WebhookEvent;
  email: string;
  name: string;
  temporaryPassword?: string;
}) {
  if (!env.N8N_WEBHOOK_URL) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: input.event,
        email: input.email,
        name: input.name,
        temporaryPassword: input.temporaryPassword ?? "",
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
  } catch {
    // Webhook não pode quebrar o fluxo principal (MVP / free tier).
  } finally {
    clearTimeout(timeout);
  }
}

