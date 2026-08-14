-- Public tenant identity boundary.
-- Internal UUID remains the relational key; public_id is the only tenant
-- identifier intended for API/UI/external integrations.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS public_id TEXT;

UPDATE tenants
SET public_id = 'ten_' || encode(gen_random_bytes(16), 'hex')
WHERE public_id IS NULL;

ALTER TABLE tenants
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_public_id_idx
  ON tenants(public_id);

COMMENT ON COLUMN tenants.public_id IS
  'Opaque public tenant identifier; use in APIs, JWT claims, GitHub/Stripe integrations. Internal id remains private.';
