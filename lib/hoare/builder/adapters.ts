import type { BuildProvider, BuildProviderAdapter } from "./executor";
import type { BuilderResourceKind } from "./types";

export type ProviderOperationHandler = (operation: {
  planId: string;
  resource: string;
  kind: BuilderResourceKind;
  provider: BuildProvider;
  action: "provision";
}) => Promise<void>;

export class CallbackProviderAdapter implements BuildProviderAdapter {
  constructor(
    public readonly provider: BuildProvider,
    private readonly supportedKinds: readonly BuilderResourceKind[],
    private readonly handler: ProviderOperationHandler,
  ) {}

  canBuild(kind: BuilderResourceKind): boolean {
    return this.supportedKinds.includes(kind);
  }

  provision(operation: Parameters<ProviderOperationHandler>[0]): Promise<void> {
    return this.handler(operation);
  }
}

export type ProviderAdapterFactory = (
  provider: BuildProvider,
  handler: ProviderOperationHandler,
) => BuildProviderAdapter;

export const allBuilderResourceKinds: readonly BuilderResourceKind[] = [
  "tenant", "domain", "infrastructure", "application", "api", "agent", "model", "workflow",
];

export function createCallbackAdapter(
  provider: BuildProvider,
  handler: ProviderOperationHandler,
): BuildProviderAdapter {
  return new CallbackProviderAdapter(provider, allBuilderResourceKinds, handler);
}
