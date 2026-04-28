import { z } from "zod";

const serverSchema = z.object({
  AUTH_JWT_SECRET: z.string().min(32),
  N8N_WEBHOOK_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
});

export const env = serverSchema.parse({
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
  APP_URL: process.env.APP_URL,
});

