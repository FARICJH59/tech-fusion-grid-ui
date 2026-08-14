import { createHash } from "node:crypto";
import type { RepositoryImportRequest, RepositoryInventory } from "./types";

export function inventoryRepository(
  request: RepositoryImportRequest,
  files: string[],
): RepositoryInventory {
  const sorted = [...files].sort();
  const joined = sorted.join("\n");
  const hash = (prefix: string) =>
    createHash("sha256")
      .update(`${prefix}:${request.repository}:${request.ref ?? "default"}:${joined}`)
      .digest("hex");

  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const packageManagers = new Set<string>();
  const workflows: string[] = [];
  const deploymentTargets = new Set<string>();

  for (const file of sorted) {
    if (/\.(ts|tsx)$/.test(file)) languages.add("typescript");
    if (/\.(js|jsx|mjs|cjs)$/.test(file)) languages.add("javascript");
    if (/\.py$/.test(file)) languages.add("python");
    if (/\.rs$/.test(file)) languages.add("rust");
    if (/\.go$/.test(file)) languages.add("go");
    if (file === "package.json") packageManagers.add("npm");
    if (file === "pnpm-lock.yaml") packageManagers.add("pnpm");
    if (file === "yarn.lock") packageManagers.add("yarn");
    if (file === "Cargo.toml") packageManagers.add("cargo");
    if (file === "pyproject.toml" || file === "requirements.txt") packageManagers.add("python");
    if (file.includes("next.config")) frameworks.add("nextjs");
    if (file.includes("vite.config")) frameworks.add("vite");
    if (file.includes("angular.json")) frameworks.add("angular");
    if (file.includes("Dockerfile")) deploymentTargets.add("container");
    if (file.includes("vercel.json")) deploymentTargets.add("vercel");
    if (file.includes(".github/workflows/")) workflows.push(file);
    if (file.includes("cloudbuild.yaml") || file.includes("cloudbuild.yml")) deploymentTargets.add("google-cloud");
    if (file.includes("terraform")) deploymentTargets.add("terraform");
    if (file.includes("k8s/") || file.includes("kubernetes/")) deploymentTargets.add("kubernetes");
  }

  return {
    repository: request.repository,
    ref: request.ref ?? "default",
    detected: {
      languages: [...languages].sort(),
      frameworks: [...frameworks].sort(),
      package_managers: [...packageManagers].sort(),
      workflows: workflows.sort(),
      deployment_targets: [...deploymentTargets].sort(),
    },
    files: sorted,
    import_hash: hash("import"),
    provenance_hash: hash("provenance"),
  };
}
