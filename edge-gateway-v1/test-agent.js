const { executeTask } = require("./agent/core");

// TEST 1: Add device
executeTask({
  type: "add-device",
  deviceId: "smart-tv-01"
});

// TEST 2: Rewrite file (SAFE DEMO)
executeTask({
  type: "rewrite-index",
  newCode: `console.log("Gateway rewritten by agent");`
});
