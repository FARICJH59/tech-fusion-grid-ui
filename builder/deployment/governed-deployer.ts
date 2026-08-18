import type { DeploymentRequest, DeploymentResult } from "./deployment-adapter";
import { deployWithGate, type DeploymentEligibility } from "./deployment-gate";
import { DeploymentAdapterRegistry } from "./deployment-registry";

/**
 * Canonical governed deployment entrypoint.
 *
 * HOARE selects the target and governance decision; the registry resolves the
 * provider adapter. Provider credentials and SDK clients remain outside this
 * layer and are injected through registered adapters.
 */
export async function deployGoverned(
  registry: DeploymentAdapterRegistry,
  request: DeploymentRequest,
  eligibility: DeploymentEligibility,
): Promise<DeploymentResult> {
  const adapter = registry.get(request.target);
  return deployWithGate(adapter, request, eligibility);
}
