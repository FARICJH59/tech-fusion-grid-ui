import { createHash } from "node:crypto";
import type { AegisIR } from "./index";

export type AegiscVerification = {
  valid: boolean;
  hashValid: boolean;
  immutable: boolean;
  errors: string[];
};

export function verifyAegisc(ir: AegisIR): AegiscVerification {
  const canonical = JSON.stringify({ name: ir.name, version: ir.version, rules: ir.rules });
  const expected = createHash("sha256").update(canonical).digest("hex");
  const hashValid = ir.hash === expected;
  const immutable = Object.isFrozen(ir) && Object.isFrozen(ir.rules);
  const errors: string[] = [];
  if (!hashValid) errors.push("AEGISC policy hash mismatch");
  if (!immutable) errors.push("AEGISC IR is not immutable");
  return { valid: hashValid && immutable, hashValid, immutable, errors };
}
