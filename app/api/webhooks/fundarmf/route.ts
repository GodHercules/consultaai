export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import { normalizeCompany } from "@/services/company/normalize";
import { verifyFundarMfWebhookSignature, verifyTimestampWithinWindow } from "@/utils/webhookSignature";
import crypto from "node:crypto";

function sha256Hex(text: string) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pickFirst(obj: Record<string, unknown> | null | undefined, keys: string[]) {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.FUNDARMF_WEBHOOK_SECRET) {
    return Response.json({ error: "WEBHOOK_NOT_CONFIGURED" }, { status: 503 });
  }

  const timestamp = request.headers.get("x-fundarmf-timestamp") ?? "";
  const signature = request.headers.get("x-fundarmf-signature") ?? "";
  if (!timestamp || !signature) {
    return Response.json({ error: "MISSING_SIGNATURE" }, { status: 401 });
  }

  if (!verifyTimestampWithinWindow({ timestamp, windowMs: 5 * 60 * 1000 })) {
    return Response.json({ error: "STALE_TIMESTAMP" }, { status: 401 });
  }

  const rawBody = await request.text();
  const sig = verifyFundarMfWebhookSignature({
    secret: env.FUNDARMF_WEBHOOK_SECRET,
    timestamp,
    rawBody,
    signatureHeader: signature,
  });
  if (!sig.ok) {
    return Response.json({ error: sig.reason }, { status: 401 });
  }

  const json = (() => {
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return null;
    }
  })();
  if (!isRecord(json)) {
    return Response.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const deliveryKey = sha256Hex(`${timestamp}.${rawBody}`);
  const existingDelivery = await prisma.webhookDelivery.findUnique({
    where: { deliveryKey },
    select: { id: true, processedAt: true },
  });
  if (existingDelivery) {
    return Response.json({ ok: true, deduped: true });
  }

  // Aceita payload no root ou em json.company
  const srcUnknown = "company" in json ? json.company : json;
  const src = isRecord(srcUnknown) ? srcUnknown : json;

  const normalized = normalizeCompany({
    codigoInterno: asString(pickFirst(src, ["codigoInterno", "codigo_interno", "codigo", "codigoInternoEmpresa"])),
    razaoSocial: asString(pickFirst(src, ["razaoSocial", "razao_social"])),
    nomeFantasia: asString(pickFirst(src, ["nomeFantasia", "nome_fantasia", "fantasia"])),
    cnpj: asString(pickFirst(src, ["cnpj", "CNPJ"])),
    grupo: asString(pickFirst(src, ["grupo", "group"])),
    regimeTributario: asString(pickFirst(src, ["regimeTributario", "regime_tributario"])),
    sistema: asString(pickFirst(src, ["sistema", "system"])),
    certificado: asString(pickFirst(src, ["certificado", "certificate"])),
    ativo: true,
  });

  if (normalized.cnpjNumerico) {
    const exists = await prisma.company.findUnique({
      where: { cnpjNumerico: normalized.cnpjNumerico },
      select: { id: true },
    });
    if (exists) {
      await prisma.webhookDelivery.create({
        data: {
          source: "FUNDARMF",
          deliveryKey,
          signature,
          timestamp,
          payload: json as never,
          processedAt: new Date(),
        },
      });
      return Response.json({ ok: true, alreadyRegistered: true });
    }
  }

  const delivery = await prisma.webhookDelivery.create({
    data: {
      source: "FUNDARMF",
      deliveryKey,
      signature,
      timestamp,
      payload: json as never,
    },
    select: { id: true },
  });

  const pending = await prisma.pendingCompany.create({
    data: {
      source: "FUNDARMF",
      status: "PENDING",
      payload: json as never,
      deliveryId: delivery.id,
      ...normalized,
    },
    select: { id: true },
  });

  return Response.json({ ok: true, pendingCompanyId: pending.id }, { status: 202 });
}
