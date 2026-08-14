import { spawn } from "node:child_process";
import type { ExecutionUnit } from "../pasor/brain-adapter";

export type BuildTool = "cmake" | "make" | "ninja" | "aegisc";

export interface NativeBuildResult {
  command_id: string;
  tool: BuildTool;
  exit_code: number;
  stdout: string;
  stderr: string;
}

export interface NativeBuildAdapterOptions {
  cwd: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

const COMMANDS: Record<string, BuildTool> = {
  "build.cpp.cmake": "cmake",
  "build.cpp.make": "make",
  "build.cpp.ninja": "ninja",
  "build.aegisc": "aegisc",
};

function argsFor(unit: ExecutionUnit, tool: BuildTool): string[] {
  const params = unit.parameters as Record<string, unknown>;
  const args = params.args;
  if (Array.isArray(args) && args.every((item) => typeof item === "string")) {
    return args;
  }

  if (tool === "cmake") return ["--build", "."];
  if (tool === "make") return [];
  if (tool === "ninja") return [];
  return ["build", "."];
}

/**
 * Native build boundary. Only commands explicitly registered in COMMANDS can
 * execute. Arguments are passed as argv (never through a shell), so repository
 * content cannot turn parameters into shell syntax. Governance/dispatch must
 * run before this adapter is invoked.
 */
export function createNativeBuildExecutor(options: NativeBuildAdapterOptions) {
  const timeoutMs = options.timeoutMs ?? 15 * 60 * 1000;

  return async (unit: ExecutionUnit): Promise<NativeBuildResult> => {
    const tool = COMMANDS[unit.command_id];
    if (!tool) {
      throw new Error(`UNSUPPORTED_NATIVE_BUILD_COMMAND:${unit.command_id}`);
    }

    const argv = argsFor(unit, tool);

    return await new Promise<NativeBuildResult>((resolve, reject) => {
      const child = spawn(tool, argv, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`NATIVE_BUILD_TIMEOUT:${unit.unit_id}`));
      }, timeoutMs);

      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        const exitCode = code ?? 1;
        if (exitCode !== 0) {
          reject(new Error(`NATIVE_BUILD_FAILED:${tool}:${exitCode}:${stderr.slice(0, 2000)}`));
          return;
        }
        resolve({ command_id: unit.command_id, tool, exit_code: exitCode, stdout, stderr });
      });
    });
  };
}

export const nativeBuildCommands = Object.freeze({ ...COMMANDS });
