import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { GeneratedWorkspaceFile } from "../factory/application-execution";
import type { DeploymentManifest } from "./deployment-contract";
import type { RuntimeDeployment } from "./owned-runtime";

export interface PersistedRuntime {
  manifest: DeploymentManifest;
  runtime: RuntimeDeployment;
  workspace: { root: string; digest: string; files: GeneratedWorkspaceFile[] };
  createdAt: string;
}

const DATA_DIR = resolve(process.env.HOARE_RUNTIME_DATA_DIR?.trim() || ".hoare/runtime-data");

function safeId(value: string): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error("Invalid runtime identifier");
  return value;
}

function pathFor(deploymentId: string): string {
  return join(DATA_DIR, `${safeId(deploymentId)}.json`);
}

export async function persistRuntime(value: PersistedRuntime): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const target = pathFor(value.manifest.deploymentId);
  const temp = `${target}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
  await rename(temp, target);
}

export async function loadRuntime(deploymentId: string): Promise<PersistedRuntime | null> {
  try {
    const raw = await readFile(pathFor(deploymentId), "utf8");
    return JSON.parse(raw) as PersistedRuntime;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ENOENT") return null;
    throw error;
  }
}
