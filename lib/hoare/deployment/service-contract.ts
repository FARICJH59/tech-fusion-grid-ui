export type RuntimeServiceKind = "frontend" | "backend";

export interface RuntimeService {
  name: string;
  kind: RuntimeServiceKind;
  port: number;
  healthPath: string;
  protocol: "http";
  public: boolean;
}

export interface RuntimeServiceGraph {
  version: "1";
  frontend: RuntimeService;
  backend: RuntimeService;
  apiPrefix: "/api";
}

export function createRuntimeServiceGraph(applicationId: string): RuntimeServiceGraph {
  if (!applicationId) throw new Error("applicationId is required");

  return {
    version: "1",
    frontend: {
      name: `${applicationId}-frontend`,
      kind: "frontend",
      port: 3000,
      healthPath: "/",
      protocol: "http",
      public: true,
    },
    backend: {
      name: `${applicationId}-backend`,
      kind: "backend",
      port: 8080,
      healthPath: "/health",
      protocol: "http",
      public: false,
    },
    apiPrefix: "/api",
  };
}

export function backendUrl(graph: RuntimeServiceGraph, host = "127.0.0.1"): string {
  return `${graph.backend.protocol}://${host}:${graph.backend.port}`;
}

export function validateRuntimeServiceGraph(graph: RuntimeServiceGraph): void {
  if (graph.version !== "1") throw new Error("Unsupported runtime service graph version");
  if (graph.frontend.kind !== "frontend" || graph.backend.kind !== "backend") {
    throw new Error("Runtime service roles are invalid");
  }
  if (graph.frontend.port === graph.backend.port) {
    throw new Error("Frontend and backend ports must differ");
  }
  if (graph.backend.public) throw new Error("Backend service must remain private");
  if (graph.apiPrefix !== "/api") throw new Error("Unsupported API prefix");
}
