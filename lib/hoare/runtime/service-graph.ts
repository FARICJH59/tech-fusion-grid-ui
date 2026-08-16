import type { ServiceSpec } from "./native-executor";

export type ApplicationServiceGraph = {
  frontend: ServiceSpec;
  backend: ServiceSpec;
  dependencies?: ServiceSpec[];
};

export function createServiceGraph(root: string): ApplicationServiceGraph {
  return {
    frontend: {
      id: "frontend",
      command: "npm",
      args: ["run", "start"],
      cwd: `${root}/frontend`,
      port: 3000,
      healthUrl: "http://127.0.0.1:3000/",
    },
    backend: {
      id: "backend",
      command: "npm",
      args: ["run", "start"],
      cwd: `${root}/backend`,
      port: 8080,
      healthUrl: "http://127.0.0.1:8080/health",
    },
  };
}
