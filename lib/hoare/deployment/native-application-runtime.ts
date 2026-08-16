import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createApplicationBuildPlan, validateApplicationBuildPlan, type ApplicationIntent } from "@/lib/hoare/factory/application-contract";
import { executeNativeApplication } from "@/lib/hoare/factory/application-execution";
import { deploymentRegistry, type DeploymentRecord } from "@/lib/hoare/deployment/deployment-registry";

export type NativeApplicationRuntime = {
  deploymentId: string;
  applicationId: string;
  root: string;
  frontend?: { pid?: number; port: number; status: "running" | "stopped" };
  backend?: { pid?: number; port: number; status: "running" | "stopped" };
};

type Managed = { child: ChildProcess; deploymentId: string; component: "frontend" | "backend" };

const managed = new Map<string, Managed[]>();

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") || "application";
}

async function materialize(root: string, files: Array<{ path: string; content: string }>): Promise<void> {
  for (const file of files) {
    const target = path.resolve(root, file.path);
    if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Unsafe workspace path: ${file.path}`);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}

function run(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, CI: "1" }, shell: false, stdio: "pipe" });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed (${code}): ${output.slice(-6000)}`)));
  });
}

function startProcess(
  deployment: DeploymentRecord,
  component: "frontend" | "backend",
  cwd: string,
  port: number,
): ChildProcess {
  const args = component === "frontend" ? ["run", "start", "--", "-p", String(port)] : ["run", "start"];
  const child = spawn("npm", args, {
    cwd,
    env: { ...process.env, PORT: String(port), HOSTNAME: "0.0.0.0", HOARE_DEPLOYMENT_ID: deployment.id },
    shell: false,
    stdio: "ignore",
  });
  const entry: Managed = { child, deploymentId: deployment.id, component };
  managed.set(deployment.id, [...(managed.get(deployment.id) ?? []), entry]);
  const remove = () => {
    const remaining = (managed.get(deployment.id) ?? []).filter((item) => item.child !== child);
    if (remaining.length) managed.set(deployment.id, remaining); else managed.delete(deployment.id);
  };
  child.once("exit", remove);
  child.once("error", remove);
  return child;
}

export async function buildAndStartNativeApplication(
  deployment: DeploymentRecord,
  intent: ApplicationIntent,
): Promise<NativeApplicationRuntime> {
  const plan = createApplicationBuildPlan({ ...intent, tenantId: deployment.tenantId, projectId: deployment.projectId, name: deployment.name });
  validateApplicationBuildPlan(plan);
  const execution = await executeNativeApplication(plan);
  if (execution.lifecycle !== "completed" || !execution.build.ok) {
    throw new Error("HOARE application build failed");
  }

  const root = path.resolve(process.cwd(), "generated", deployment.tenantId, deployment.projectId, execution.applicationId);
  await materialize(root, execution.workspace.files);

  const frontendRoot = path.join(root, "frontend");
  const backendRoot = path.join(root, "backend");
  await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], frontendRoot);
  await run("npm", ["run", "build"], frontendRoot);
  await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], backendRoot);
  await run("npm", ["run", "build"], backendRoot);

  const frontendPort = Number(process.env.HOARE_FRONTEND_PORT ?? 3100) + managed.size;
  const backendPort = Number(process.env.HOARE_BACKEND_PORT ?? 8100) + managed.size;
  const backend = startProcess(deployment, "backend", backendRoot, backendPort);
  const frontend = startProcess(deployment, "frontend", frontendRoot, frontendPort);

  await deploymentRegistry.update(deployment.tenantId, deployment.id, {
    status: "running",
    frontendEndpoint: `http://127.0.0.1:${frontendPort}`,
    backendEndpoint: `http://127.0.0.1:${backendPort}`,
    manifest: { ...(deployment.manifest ?? {}), applicationId: execution.applicationId, workspace: root, ports: { frontend: frontendPort, backend: backendPort } },
  });

  return {
    deploymentId: deployment.id,
    applicationId: execution.applicationId,
    root,
    frontend: { pid: frontend.pid, port: frontendPort, status: "running" },
    backend: { pid: backend.pid, port: backendPort, status: "running" },
  };
}

export async function stopNativeApplication(tenantId: string, deploymentId: string): Promise<void> {
  for (const entry of managed.get(deploymentId) ?? []) entry.child.kill("SIGTERM");
  managed.delete(deploymentId);
  await deploymentRegistry.update(tenantId, deploymentId, { status: "stopped" });
}

export function nativeApplicationStatus(deploymentId: string): NativeApplicationRuntime | null {
  const processes = managed.get(deploymentId);
  if (!processes?.length) return null;
  return { deploymentId, applicationId: String(processes[0].child.pid ?? deploymentId), root: "", frontend: undefined, backend: undefined };
}
