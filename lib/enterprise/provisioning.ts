import type { Role } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export type ProvisioningInput = {
  userId: string;
  email: string;
  displayName?: string;
  organizationName?: string;
  role?: Role;
};

export type ProvisioningResult = {
  tenantId: string;
  tenantSlug: string;
  userRole: Role;
  created: boolean;
};

type TenantRow = {
  id: string;
  slug: string;
};

type UserRow = {
  id: string;
  tenant_id: string;
  role: Role;
};

function slugify(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "tenant";
}

export function deterministicTenantSlug(
  email: string,
  userId: string,
  organizationName?: string,
): string {
  const local = email.split("@")[0] ?? "tenant";
  const base = slugify(organizationName ?? local);
  const suffix = slugify(`${local}-${userId.slice(0, 8)}`).slice(0, 20);
  return `${base}-${suffix}`.slice(0, 63);
}

export async function ensureTenantProvisioning(
  input: ProvisioningInput,
): Promise<ProvisioningResult> {
  if (!supabaseAdmin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for tenant provisioning");
  }

  const userRole: Role = input.role ?? "viewer";
  const tenantSlug = deterministicTenantSlug(input.email, input.userId, input.organizationName);
  const organizationDisplayName =
    input.organizationName?.trim() || `${input.email.split("@")[0]}'s Workspace`;

  const existingUser = await supabaseAdmin
    .from("users")
    .select("id, tenant_id, role")
    .eq("id", input.userId)
    .maybeSingle<UserRow>();

  if (existingUser.error) {
    throw new Error(`Failed to check existing user: ${existingUser.error.message}`);
  }

  if (existingUser.data) {
    const existingTenant = await supabaseAdmin
      .from("tenants")
      .select("id, slug")
      .eq("id", existingUser.data.tenant_id)
      .maybeSingle<TenantRow>();

    if (existingTenant.error) {
      throw new Error(`Failed to read existing tenant: ${existingTenant.error.message}`);
    }

    return {
      tenantId: existingUser.data.tenant_id,
      tenantSlug: existingTenant.data?.slug ?? tenantSlug,
      userRole: existingUser.data.role,
      created: false,
    };
  }

  const tenantUpsert = await supabaseAdmin
    .from("tenants")
    .upsert(
      {
        slug: tenantSlug,
        name: organizationDisplayName,
      },
      { onConflict: "slug" },
    )
    .select("id, slug")
    .single<TenantRow>();

  if (tenantUpsert.error || !tenantUpsert.data) {
    throw new Error(`Failed to upsert tenant: ${tenantUpsert.error?.message ?? "unknown error"}`);
  }

  const userUpsert = await supabaseAdmin
    .from("users")
    .upsert(
      {
        id: input.userId,
        tenant_id: tenantUpsert.data.id,
        email: input.email,
        role: userRole,
        display_name: input.displayName,
      },
      { onConflict: "id" },
    )
    .select("id")
    .single<{ id: string }>();

  if (userUpsert.error) {
    throw new Error(`Failed to upsert user: ${userUpsert.error.message}`);
  }

  const auditInsert = await supabaseAdmin.from("audit_events").insert({
    tenant_id: tenantUpsert.data.id,
    actor_id: input.userId,
    action: "tenant.provisioned",
    details: "Initial tenant/workspace provisioning completed",
    metadata: {
      tenantSlug: tenantUpsert.data.slug,
      source: "auth.signup",
    },
  });

  if (auditInsert.error) {
    throw new Error(`Failed to insert provisioning audit event: ${auditInsert.error.message}`);
  }

  return {
    tenantId: tenantUpsert.data.id,
    tenantSlug: tenantUpsert.data.slug,
    userRole,
    created: true,
  };
}
