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

if (!supabaseServiceRoleKey) {
  console.warn(
    "[supabase] SUPABASE_SERVICE_ROLE_KEY is not configured. " +
      "Admin-level provisioning and billing writes will be limited.",
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
);

export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export default supabase;
