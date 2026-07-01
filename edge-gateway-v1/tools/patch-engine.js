const fs = require("fs");
const path = require("path");

/**
 * Patch format:
 * {
 *   file: "index.js",
 *   action: "write",
 *   content: "..."
 * }
 */

function applyPatch(patch) {
  const targetPath = path.join(process.cwd(), patch.file);

  if (patch.action === "write") {
    fs.writeFileSync(targetPath, patch.content, "utf-8");
    console.log(`✅ Wrote file: ${patch.file}`);
  }

  if (patch.action === "append") {
    fs.appendFileSync(targetPath, patch.content);
    console.log(`➕ Appended to: ${patch.file}`);
  }

  if (patch.action === "delete") {
    fs.unlinkSync(targetPath);
    console.log(`🗑️ Deleted file: ${patch.file}`);
  }
}

/**
 * Execute a full patch bundle
 */
function runPatchBundle(bundle) {
  console.log("🚀 Running Patch Bundle...");

  bundle.patches.forEach((p) => {
    try {
      applyPatch(p);
    } catch (err) {
      console.error("❌ Patch failed:", p.file, err.message);
    }
  });

  console.log("✅ Patch bundle complete");
}

module.exports = {
  applyPatch,
  runPatchBundle
};
