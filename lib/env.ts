import { z } from "zod";

const optionalInt = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : value;
  }
  return value;
}, z.number().int().positive().optional());

const serverSchema = z.object({
  AUTH_JWT_SECRET: z.string().min(32),
  N8N_WEBHOOK_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  FUNDARMF_WEBHOOK_SECRET: z.string().min(16).optional(),
  FUNDARMF_API_KEY: z.string().min(16).optional(),
  FUNDARMF_ALLOWED_ORIGIN: z.string().url().optional(),
  FUNDARMF_WEBHOOK_TOLERANCE_SECONDS: optionalInt,
});

type Env = {
  AUTH_JWT_SECRET?: string;
  N8N_WEBHOOK_URL?: string;
  APP_URL?: string;
  FUNDARMF_WEBHOOK_SECRET?: string;
  FUNDARMF_API_KEY?: string;
  FUNDARMF_ALLOWED_ORIGIN?: string;
  FUNDARMF_WEBHOOK_TOLERANCE_SECONDS?: number;
};

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
    APP_URL: process.env.APP_URL,
    FUNDARMF_WEBHOOK_SECRET: process.env.FUNDARMF_WEBHOOK_SECRET,
    FUNDARMF_API_KEY: process.env.FUNDARMF_API_KEY,
    FUNDARMF_ALLOWED_ORIGIN: process.env.FUNDARMF_ALLOWED_ORIGIN,
    FUNDARMF_WEBHOOK_TOLERANCE_SECONDS: process.env.FUNDARMF_WEBHOOK_TOLERANCE_SECONDS,
  });

  cached = parsed.success
    ? parsed.data
    : {
        AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
        N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
        APP_URL: process.env.APP_URL,
        FUNDARMF_WEBHOOK_SECRET: process.env.FUNDARMF_WEBHOOK_SECRET,
      };

  return cached;
}
