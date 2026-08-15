# TechFusion Owned Platform Runtime

This repository is being progressively separated into an owned platform core and replaceable deployment adapters.

## Boundary

- `platform/` is the platform authority: tenants, identity, governance, agents, workflows and deployment orchestration.
- `runtime/` is the framework-independent web runtime and static UI shell.
- `adapters/` contains integrations with external execution targets.
- `mcp/` remains the HOARE agent/control-plane implementation and is integrated behind the platform boundary.

## Vercel policy

Vercel remains supported, but only as an adapter. The product UI and control-plane contracts must not require Vercel APIs or Vercel hosting semantics.

## WWW deployment

The owned runtime exposes a normal HTTP service and can therefore sit behind any DNS/TLS edge. The first production path can be Cloudflare DNS/TLS -> owned runtime. Cloud Run, a VM, Kubernetes, Docker, Raspberry Pi/Jetson edge gateways, and Vercel can be deployment targets without changing the platform API.

## Extraction sequence

1. Establish platform/runtime/adapter boundaries.
2. Move tenant and authorization authority behind platform APIs.
3. Move agent/workflow execution behind platform APIs.
4. Add persistent state and tenant isolation.
5. Add deployment adapters (Vercel, Cloud Run, Cloudflare, self-hosted).
6. Replace the current framework-bound UI routes incrementally with the owned runtime.
7. Make the owned runtime the canonical WWW entry point.
