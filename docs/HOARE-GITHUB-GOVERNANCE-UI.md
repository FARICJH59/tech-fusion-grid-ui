# HOARE GitHub Governance UI

**Provenance:** 2026-09-13 — additive control-plane implementation.

## Purpose

The HOARE control-plane UI provides a thin operator surface over the governed GitHub broker in `HOARE-AGENT`.

It does **not** implement authorization, GitHub policy, tenant isolation, or AEGIS decisions in the browser.

## Flow

```text
Browser
  │
  │ same-origin requests
  ▼
tech-fusion-grid-ui /api/hoare/github/*
  │
  │ forwards existing HOARE auth context
  ▼
HOARE Agent /integrations/github/*
  │
  ▼
GitHub Broker
  │
  ▼
AEGIS ALLOW / DENY / ESCALATE
  │
  ▼
GitHub
```

## Browser credential rule

The UI deliberately has no GitHub token field and does not store GitHub credentials in browser state.

The HOARE Agent owns the GitHub installation credential. In the current integration, the backend may resolve it from its server-side `HOARE_GITHUB_TOKEN` development configuration. Production should use the approved GitHub App installation-token/secret-management path.

## UI capabilities

- install tenant-scoped repository permissions
- inspect authorized repository metadata
- analyze a repository README through the broker
- evaluate GitHub actions through AEGIS
- create governed branches
- create pull requests
- display tenant-scoped governance audit evidence
- display ALLOW / DENY / ESCALATE outcomes

## Deployment

Set the server-side environment variable:

```bash
HOARE_API_BASE_URL=http://127.0.0.1:8080
```

For a separately deployed HOARE Agent, point `HOARE_API_BASE_URL` at the authenticated HOARE Agent HTTP endpoint instead. Do not use a `NEXT_PUBLIC_` variable for this value when it would expose a private backend endpoint or credential.

Local default behavior targets the existing HOARE HTTP service at `127.0.0.1:8080`.

## Security invariants

1. Browser code never decides ALLOW/DENY/ESCALATE.
2. Browser code never receives the GitHub installation token.
3. The proxy forwards the existing HOARE authentication context to the backend.
4. Repository scope remains tenant-bound in the HOARE Agent.
5. Merge/deploy/secrets remain restricted backend actions.
6. A UI action cannot bypass the AEGIS boundary.
7. Audit evidence is rendered from the backend; it is not fabricated client-side.
