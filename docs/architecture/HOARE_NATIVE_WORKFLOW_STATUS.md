# Native HOARE Workflow Status

The native provider-neutral workflow layer is implemented on the execution-fabric branch.

## Implemented

- `HoareWorkflow` contract
- Workflow validation
- Versioned workflow registry
- Execution adapter registry
- GitHub Actions adapter contract
- GCP, AWS, Azure, and Kubernetes adapter contracts
- Native workflow tests
- Customer-intent-to-Cloud-Run example
- Native workflow architecture documentation

## Source of truth

The native `HoareWorkflow` is the source of truth. GitHub Actions is optional and remains an execution adapter.

## Next implementation layer

The next step is to connect workflow generation to the existing HOARE planner/agent runtime so a customer intent can produce a validated `HoareWorkflow` automatically, then pass it through authorization, identity, execution coordination, adapter compilation, verification, and remediation.
