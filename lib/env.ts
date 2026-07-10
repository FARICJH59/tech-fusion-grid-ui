/**
 * Typed, validated environment variable configuration.
 *
 * All values are read from process.env at module load time and validated with
 * Zod. Calling code should import named values from this module instead of
 * reading process.env directly.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Helper schemas
// ---------------------------------------------------------------------------

const positiveIntStr = z
  .string()
  .optional()
  .transform((v) => (v ? parseInt(v, 10) : undefined))
  .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), {
    message: "Must be a positive integer",
  });

const boolStr = (defaultVal: boolean) =>
  z
    .string()
    .optional()
    .default(defaultVal ? "true" : "false")
    .transform((v) => v === "true");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const EnvSchema = z.object({
  // Application
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: positiveIntStr,

  // Supabase
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  // MQTT broker
  MQTT_URL: z.string().optional(),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_CLIENT_ID: z.string().optional(),
  MQTT_CA_CERT: z.string().optional(),
  MQTT_CLIENT_CERT: z.string().optional(),
  MQTT_CLIENT_KEY: z.string().optional(),
  MQTT_REJECT_UNAUTHORIZED: boolStr(true),
  MQTT_LWT_TOPIC: z.string().optional(),
  MQTT_LWT_PAYLOAD: z.string().optional(),
  MQTT_LWT_QOS: z.enum(["0", "1", "2"]).optional(),
  MQTT_LWT_RETAIN: boolStr(false),

  // Redis
  REDIS_URL: z.string().optional(),

  // JWT / auth
  JWT_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_TTL_SECONDS: positiveIntStr,
  JWT_REFRESH_TTL_SECONDS: positiveIntStr,

  // Rate limiting
  RATE_LIMIT_MAX: positiveIntStr,
  RATE_LIMIT_WINDOW_MS: positiveIntStr,

  // Telemetry WebSocket
  NEXT_PUBLIC_TELEMETRY_WS_URL: z.string().optional(),

  // OpenTelemetry
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default("tech-fusion-grid-ui"),
});

// ---------------------------------------------------------------------------
// Parse and export
// ---------------------------------------------------------------------------

// Use safeParse so the app can start even with missing optional vars; missing
// required vars are surfaced as warnings rather than hard crashes at import
// time (runtime guards remain in the code that uses them).
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "[env] Environment variable validation errors:",
    parsed.error.flatten().fieldErrors,
  );
}

const env = parsed.success ? parsed.data : EnvSchema.parse({});

export { env };
export type Env = z.infer<typeof EnvSchema>;
