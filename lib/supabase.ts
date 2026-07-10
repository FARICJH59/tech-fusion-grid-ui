import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[supabase] SUPABASE_URL and SUPABASE_ANON_KEY must be set in production.",
    );
  }
  console.warn(
    "[supabase] SUPABASE_URL or SUPABASE_ANON_KEY is not configured. " +
      "Database queries will fail at runtime.",
  );
}

/**
 * Anon client — used for unauthenticated operations (e.g. signInWithPassword).
 * Subject to Row Level Security.
 */
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
);

/**
 * Service-role client — bypasses Row Level Security.
 * Use ONLY for server-side operations where tenant isolation is enforced
 * at the application layer (e.g. `.eq("tenant_id", user.tenantId)`).
 * Never expose this client or its key to the browser.
 */
export const supabaseAdmin = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseServiceRoleKey || supabaseAnonKey || "placeholder",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export default supabase;
