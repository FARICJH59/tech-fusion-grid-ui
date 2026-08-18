import { ActionAuthorizationEngine } from "../lib/hoare-actions";

const environment = (process.env.HOARE_ENVIRONMENT ?? "staging") as "development" | "staging" | "production";
const action = process.env.HOARE_ACTION ?? "deploy.production";
const actor = process.env.GITHUB_ACTOR ?? "github-actions";
const tenantId = process.env.HOARE_TENANT_ID ?? "default";
const role = process.env.HOARE_ACTOR_ROLE ?? "operator";

const policies = [
  { action: "deploy.production", effect: "ALLOW" as const, roles: ["operator", "admin", "service"], environments: ["production"] },
  { action: "deploy.staging", effect: "ALLOW" as const, roles: ["operator", "admin", "service"], environments: ["staging"] },
];

const engine = new ActionAuthorizationEngine(policies);
const decision = engine.decide({ action, actor, tenantId, environment }, role);
console.log(JSON.stringify(decision));
if (decision.effect !== "ALLOW") process.exit(1);
