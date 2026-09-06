# TCX Live Side-Effect Gate

This branch hardens the runtime boundary so a live GCP provider cannot execute without a TCX-issued, attempt-bound authority carrying AEGIS authorization and verification proof bindings.

This is an incremental security boundary. Cloud controller deployment, traffic migration, rollback, and production WIF wiring remain separately gated until they use the same authority path.
