import { z } from "zod";

const serverSchema = z.object({
  AUTH_JWT_SECRET: z.string().min(32),
  N8N_WEBHOOK_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  FUNDARMF_WEBHOOK_SECRET: z.string().min(16).optional(),
});

type Env = {
  AUTH_JWT_SECRET?: string;
  N8N_WEBHOOK_URL?: string;
  APP_URL?: string;
  FUNDARMF_WEBHOOK_SECRET?: string;
};

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
    APP_URL: process.env.APP_URL,
    FUNDARMF_WEBHOOK_SECRET: process.env.FUNDARMF_WEBHOOK_SECRET,
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

