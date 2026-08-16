# HOARE GitHub Repository Import

Stage 4 introduces the repository-import boundary for the HOARE Builder.

The importer is intentionally provider-neutral. GitHub is the source-control integration; it is not the deployment platform.

Flow:

GitHub authentication → repository selection → repository inventory → technology detection → provenance → PASOR planning → simulation → governance → target execution.

The inventory layer does not execute repository code. It produces deterministic metadata that PASOR and the governance plane can consume.

Security boundary:
- tenant_id is required by the import contract;
- repository contents are treated as untrusted input;
- secrets are not imported into the execution plan;
- deployment is a separate governed action;
- provider-specific deployment remains downstream of the builder.
