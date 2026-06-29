import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  GPS51_WEBHOOK_SECRET: z.string().optional(),
  GPS51_WEBHOOK_BASIC_USER: z.string().optional(),
  GPS51_WEBHOOK_BASIC_PASSWORD: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (!cached) {
    cached = serverEnvSchema.parse({
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
      WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
      WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
      GPS51_WEBHOOK_SECRET: process.env.GPS51_WEBHOOK_SECRET,
      GPS51_WEBHOOK_BASIC_USER: process.env.GPS51_WEBHOOK_BASIC_USER,
      GPS51_WEBHOOK_BASIC_PASSWORD: process.env.GPS51_WEBHOOK_BASIC_PASSWORD,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    });
  }
  return cached;
}

export function getWhatsAppConfig() {
  const env = getServerEnv();
  return {
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN,
  };
}

export function getGoogleMapsApiKey() {
  return getServerEnv().GOOGLE_MAPS_API_KEY ?? "";
}

export function getGps51Config() {
  const env = getServerEnv();
  return {
    webhookSecretConfigured: Boolean(env.GPS51_WEBHOOK_SECRET?.trim()),
    basicAuthConfigured: Boolean(
      env.GPS51_WEBHOOK_BASIC_USER?.trim() && env.GPS51_WEBHOOK_BASIC_PASSWORD?.trim()
    ),
    appUrl: env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
}
