import { createHash } from "node:crypto";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { GeneratedWorkspaceFile } from "./application-execution";

export type BuildStepStatus = "passed" | "failed";

export interface BuildStepResult {
  name: string;
  status: BuildStepStatus;
  command: string;
  exitCode: number;
  durationMs: number;
  output: string;
}

export interface NativeBuildResult {
  ok: boolean;
  artifactDigest: string;
  steps: BuildStepResult[];
}

function run(command: string, args: string[], cwd: string): Promise<BuildStepResult> {
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, CI: "1" }, shell: false });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.on("error", (error) => resolve({
      name: `${command} ${args.join(" ")}`,
      status: "failed",
      command: `${command} ${args.join(" ")}`,
      exitCode: -1,
      durationMs: Date.now() - started,
      output: error.message,
    }));
    child.on("close", (code) => resolve({
      name: `${command} ${args.join(" ")}`,
      status: code === 0 ? "passed" : "failed",
      command: `${command} ${args.join(" ")}`,
      exitCode: code ?? -1,
      durationMs: Date.now() - started,
      output: output.slice(-12000),
    }));
  });
}

export async function executeNativeBuild(
  files: GeneratedWorkspaceFile[],
): Promise<NativeBuildResult> {
  const root = await mkdtemp(path.join(os.tmpdir(), "hoare-build-"));
  const digest = createHash("sha256")
    .update(files.map((file) => `${file.path}\0${file.content}`).join("\0"))
    .digest("hex");

  try {
    for (const file of files) {
      const target = path.join(root, file.path);
      if (!target.startsWith(`${root}${path.sep}`)) throw new Error(`Unsafe build path: ${file.path}`);
      await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(target), { recursive: true }));
      await writeFile(target, file.content, "utf8");
    }

    const steps: BuildStepResult[] = [];
    const frontendPackage = path.join(root, "frontend", "package.json");
    const backendPackage = path.join(root, "backend", "package.json");

    await access(frontendPackage);
    await access(backendPackage);

    steps.push(await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], path.join(root, "frontend")));
    if (steps.at(-1)?.status === "passed") {
      steps.push(await run("npm", ["run", "build"], path.join(root, "frontend")));
    }

    steps.push(await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], path.join(root, "backend")));
    if (steps.at(-1)?.status === "passed") {
      steps.push(await run("npm", ["run", "build"], path.join(root, "backend")));
    }

    return { ok: steps.every((step) => step.status === "passed"), artifactDigest: digest, steps };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
