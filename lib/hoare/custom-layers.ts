import { FusionSearch, FusionSearchSource } from "../fusion-search";
import { AegisPolicy } from "../aegis";
import { compileAegis, AegisIR } from "../aegisc";
import { Sentinel, SentinelRequest, SentinelResult } from "../sentinel";

export class HoareCustomLayers {
  readonly search: FusionSearch;
  readonly sentinel: Sentinel;
  readonly compiledPolicy: AegisIR;

  constructor(policy: AegisPolicy, sources: FusionSearchSource[]) {
    this.compiledPolicy = compileAegis(policy);
    this.sentinel = new Sentinel(policy);
    this.search = new FusionSearch(sources);
  }

  authorize(request: SentinelRequest): SentinelResult {
    return this.sentinel.evaluate(request);
  }

  async executeAuthorized<T>(request: SentinelRequest, action: () => Promise<T>): Promise<{ decision: SentinelResult; result: T }> {
    const decision = this.sentinel.assertAllowed(request);
    return { decision, result: await action() };
  }
}
