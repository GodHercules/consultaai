import crypto from "node:crypto";

export function computeHmacSha256Hex(input: { secret: string; message: string }) {
  return crypto.createHmac("sha256", input.secret).update(input.message, "utf8").digest("hex");
}

export function safeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyTimestampWithinWindow(input: { timestamp: string; windowMs: number }) {
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) return false;
  const drift = Math.abs(Date.now() - ts);
  return drift <= input.windowMs;
}

export function verifyFundarMfWebhookSignature(input: {
  secret: string;
  timestamp: string;
  event: string;
  deliveryId: string;
  rawBody: string;
  signatureHeader: string;
}) {
  // Header esperado: "v1=<hex>"
  const match = input.signatureHeader.match(/^v1=([a-f0-9]{64})$/i);
  if (!match) return { ok: false as const, reason: "INVALID_SIGNATURE_FORMAT" as const };
  const provided = match[1].toLowerCase();

  const message = `${input.timestamp}.${input.event}.${input.deliveryId}.${input.rawBody}`;
  const expected = computeHmacSha256Hex({ secret: input.secret, message });

  const ok = safeEqualHex(expected, provided);
  return ok ? ({ ok: true as const } as const) : ({ ok: false as const, reason: "INVALID_SIGNATURE" as const } as const);
}
