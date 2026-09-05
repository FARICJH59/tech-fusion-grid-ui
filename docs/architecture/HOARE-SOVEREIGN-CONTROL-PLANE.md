# HOARE Sovereign Control Plane

## Objective

HOARE owns the application layer: frontend, backend/API, agent runtime, builder, policy engine, deployment compiler, and tenant control plane. External platforms are infrastructure adapters, not application dependencies.

## Runtime topology

```text
                         Internet
                            |
                     Cloudflare DNS/Edge
                            |
                 +----------+----------+
                 |                     |
          Public HOARE UI/API     Private HOARE services
                 |                     |
             Cloud Run          Cloudflare Tunnel
                 |                     |
        +--------+---------+      MCP / admin / edge
        |        |         |
   PostgreSQL  Redis     MQTT
        |        |         |
        +--------+---------+
                 |
          HOARE Runtime
                 |
      Builder / Agents / Policy
                 |
      AEGISC / Execution Plans
```

## Ownership boundary

HOARE owns:

- UI generation and rendering
- API and backend contracts
- authentication and tenant isolation
- agent and workflow runtime
- builder planning and compilation
- policy and approval gates
- deployment manifests
- revenue and usage metering
- infrastructure adapter interfaces

Infrastructure providers only supply compute, networking, storage, DNS, messaging, or model APIs through adapters.

## Deployment path

1. Developer pushes to GitHub.
2. GitHub Actions runs lint, typecheck, tests, security checks, Docker build, and integration tests.
3. A production deployment job authenticates to Google Cloud with Workload Identity Federation.
4. The container is published to Artifact Registry.
5. Cloud Run receives the immutable image digest.
6. Cloudflare DNS points the HOARE domain at the public runtime.
7. Cloudflare Tunnel is reserved for private/control-plane services that should not be directly exposed.
8. Runtime health and deployment state are reported back to HOARE.

## No Vercel dependency

Vercel may remain as a historical deployment target for `tech-fusion-grid-ui`, but the HOARE production path does not require Vercel. The application is already containerized with Next.js standalone output and can run as an ordinary Node container.

## Secret boundary

Never commit Supabase, Stripe, JWT, MQTT, Redis, or Cloudflare credentials. GitHub Actions should use OIDC/WIF for Google Cloud. Runtime secrets should be injected by the runtime secret manager. The browser receives only explicitly public configuration.

## Supabase key normalization

The current application contains both modern Supabase naming (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) and legacy application naming (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). The control plane should normalize these at the adapter boundary rather than copying secret values into source code or `.env` files.

Recommended mapping:

- `SUPABASE_PUBLISHABLE_KEY` -> public/client key
- `SUPABASE_SECRET_KEY` -> server/service key
- `SUPABASE_URL` -> project URL
- `SUPABASE_JWKS_URL` -> JWT verification metadata

Compatibility aliases can be supported temporarily for existing modules.

## Cloudflare role

Cloudflare is the domain and edge boundary, not the builder. HOARE generates and owns the application. DNS, TLS, WAF, and optional tunnel connectivity are infrastructure concerns exposed through an adapter.
