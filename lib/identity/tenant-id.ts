import { randomBytes } from "node:crypto";

/**
 * Public tenant identifier. The format is intentionally Stripe-like in shape
 * (stable type prefix + opaque token) without pretending to be a Stripe ID.
 * Internal database UUIDs must not be exposed as tenant IDs in APIs.
 */
export const TENANT_ID_PREFIX = "ten_";

export function createTenantId(): string {
  return `${TENANT_ID_PREFIX}${randomBytes(16).toString("hex")}`;
}

export function isTenantId(value: string): boolean {
  return /^ten_[a-f0-9]{32}$/.test(value);
}

export function assertTenantId(value: string): string {
  if (!isTenantId(value)) throw new Error("Invalid tenant ID");
  return value;
}
