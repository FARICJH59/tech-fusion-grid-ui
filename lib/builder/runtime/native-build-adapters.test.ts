import assert from "node:assert/strict";
import test from "node:test";
import { nativeBuildCommands } from "./native-build-adapters";

test("native build adapter exposes only allowlisted build commands", () => {
  assert.deepEqual(nativeBuildCommands, {
    "build.cpp.cmake": "cmake",
    "build.cpp.make": "make",
    "build.cpp.ninja": "ninja",
    "build.aegisc": "aegisc",
  });
});

test("native build adapter does not expose arbitrary command ids", () => {
  assert.equal((nativeBuildCommands as Record<string, string>).constructor, Object);
  assert.equal("rm" in nativeBuildCommands, false);
  assert.equal("sh" in nativeBuildCommands, false);
});
