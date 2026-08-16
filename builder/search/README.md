# HOARE Web Search Capability

`search.web` is the provider-neutral capability exposed to PASOR. SerpApi is the first adapter.

## Security boundary

- Never place a SerpApi key in an ExecutionUnit.
- Never put provider credentials in browser code, repository imports, provenance records, or normal logs.
- The adapter reads `SERPAPI_KEY` from the runtime environment; production should inject it through a secret manager.
- Tenant and project identifiers are carried into provenance so results remain attributable.
- Search is external I/O and must be simulated, quota-checked, authorized, and audited before execution.

## Architecture

`intent -> PASOR -> search.web ExecutionUnit -> governance -> SerpApi adapter -> evidence/provenance -> downstream planning`

The `search.web` capability intentionally does not expose SerpApi-specific details to PASOR. A future provider can replace the adapter without changing the planning contract.
