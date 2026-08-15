import { DeploymentAdapter } from './adapter.mjs';

export class VercelAdapter extends DeploymentAdapter {
  constructor(config = {}) { super('vercel'); this.config = config; }
  async deploy(request) {
    return { adapter: this.name, mode: 'external-target', project: request?.project || this.config.project || null, delegated: true };
  }
  async status() { return { adapter: this.name, status: 'AVAILABLE_AS_ADAPTER' }; }
  async destroy(request) { return { adapter: this.name, destroyed: false, project: request?.project || null, delegated: true }; }
}
