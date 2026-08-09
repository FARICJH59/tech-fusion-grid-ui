import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const project = await readFile("project.toml", "utf8");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const lock = await readFile("package-lock.json", "utf8");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const manifest = {
  schema: "hoare.build-manifest/v0.1",
  project: {
    name: pkg.name,
    version: pkg.version,
    framework: "nextjs",
    node: "22",
    packageManager: "npm",
  },
  source: {
    revision: git(["rev-parse", "HEAD"]),
    dirty: git(["status", "--porcelain"]).length > 0,
  },
  build: {
    contract: "project.toml",
    contractDigest: sha256(project),
    command: pkg.scripts?.build ?? "npm run build",
    output: ".next/standalone",
    artifact: "oci",
  },
  runtime: {
    port: 3000,
    healthPath: "/api/health",
    nonRoot: true,
  },
  security: {
    providerNeutral: true,
    secretsAtRuntime: true,
    longLivedCloudCredentials: false,
    aegis: {
      executionContract: true,
      planIntegrity: true,
      fencingForMutations: true,
      leaseFinalization: true,
    },
  },
  observability: {
    openTelemetry: true,
  },
  provenance: {
    dependencyLockDigest: sha256(lock),
    generatedAt: new Date().toISOString(),
  },
  deployment: {
    targets: ["cloud-run", "kubernetes", "aws", "azure"],
  },
};

await writeFile("build-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
