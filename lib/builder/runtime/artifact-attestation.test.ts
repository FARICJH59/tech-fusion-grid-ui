import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { attestArtifact } from "./artifact-attestation";

test("attests an artifact with deterministic SHA-256 and provenance", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hoare-attest-"));
  const artifact = join(dir, "artifact.bin");
  await writeFile(artifact, "hello-hoare");

  const unit = {
    unit_id: "step1",
    command_id: "build.aegisc",
    parameters: {},
    dependencies: [],
  } as any;

  const first = await attestArtifact(unit, artifact, "prov-001");
  const second = await attestArtifact(unit, artifact, "prov-001");

  assert.equal(first.verified, true);
  assert.equal(first.artifact_sha256, second.artifact_sha256);
  assert.equal(first.attestation_hash, second.attestation_hash);
  assert.notEqual(first.attestation_hash, "");
});
