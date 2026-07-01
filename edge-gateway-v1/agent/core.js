const { runPatchBundle } = require("../tools/patch-engine");

/**
 * Simple coding agent brain (v1)
 * Converts instructions → patches
 */

function generatePlan(input) {
  console.log("🧠 Agent received:", input);

  // For now: deterministic demo logic
  if (input.type === "add-device") {
    return {
      patches: [
        {
          file: "registry/device-db.js",
          action: "append",
          content: `\n// NEW DEVICE: ${input.deviceId}\n`
        }
      ]
    };
  }

  if (input.type === "rewrite-index") {
    return {
      patches: [
        {
          file: "index.js",
          action: "write",
          content: input.newCode
        }
      ]
    };
  }

  return { patches: [] };
}

function executeTask(task) {
  const plan = generatePlan(task);

  if (!plan.patches.length) {
    console.log("⚠️ No valid patches generated");
    return;
  }

  runPatchBundle(plan);
}

module.exports = {
  executeTask
};
