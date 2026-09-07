# HOARE Autonomous Build Plane

The autonomous build plane gives HOARE two governed execution surfaces:

- **GitHub Actions** for repository/CI workflows.
- **HYDRA-EDGE / Termux** for edge-local builds and verification.

Both surfaces are downstream of TCX. A provider must receive an issuer-created `GovernedExecutionAuthority`, validate tenant/transaction/attempt identity, and revalidate authority immediately before and after the external call.

## HTTP control surface

`POST /api/hoare/build` is the HTTP control-plane entry point. It authenticates the caller and validates a build intent, but deliberately does **not** perform the side effect. Execution requires an already-admitted TCX transaction and issuer-created authority.

Example request:

```http
POST /api/hoare/build HTTP/1.1
Authorization: Bearer <control-plane-token>
Content-Type: application/json

{
  "tenantId": "tenant-1",
  "projectId": "project-1",
  "target": "github",
  "repository": "FARICJH59/example",
  "ref": "main",
  "workflow": "ci.yml"
}
```

A successful response is an `admission_required` control-plane result. It is not a deployment approval and does not imply that code was executed.

## GitHub execution

`GitHubAutonomousBuildProvider` dispatches a selected GitHub Actions workflow only after TCX authority validation. The GitHub token is supplied through runtime configuration; no credential is committed to the repository.

## Termux execution

`TermuxAutonomousBuildProvider` sends only non-secret transaction identity and build parameters to a configured HYDRA-EDGE endpoint. Transport authentication is supplied by a short-lived access-token callback. The opaque TCX authority is never serialized across the network.

The edge node must independently authenticate the caller and revalidate transaction, attempt, lease, and fence state before executing commands.

## Cloudflare domain

Cloudflare is already represented as a supported provider in the control-plane domain model. The autonomous build plane adds explicit configuration through:

- `HOARE_PUBLIC_DOMAIN`
- `CLOUDFLARE_ZONE_ID`

No domain name or Cloudflare credential is hard-coded. DNS/TLS changes are live side effects and must use the same TCX authority boundary as other infrastructure mutations.

The actual DNS cutover can be performed once the intended hostname and Cloudflare account/zone are configured. This repository change does not mutate DNS or expose Cloudflare credentials.
