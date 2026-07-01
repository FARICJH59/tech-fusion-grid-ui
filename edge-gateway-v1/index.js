const registry = require("./registry/device-db");

// Simulated MQTT / telemetry source (replace later with real broker)
function startGateway() {
  const gatewayId = `gw-${Math.random().toString(16).slice(2)}`;

  console.log("Starting Gateway:", gatewayId);
  console.log("Gateway API running on port 3000");

  // Simulated MQTT connection
  console.log("MQTT Connected");

  // Simulated device fleet
  const devices = ["plug-01", "thermo-01", "sensor-01"];

  setInterval(() => {
    const deviceId = devices[Math.floor(Math.random() * devices.length)];

    const msg = {
      gatewayId,
      deviceId,
      type: inferType(deviceId),
      power: Math.random() * 120,
      temp: 18 + Math.random() * 12,
      status: "active",
      ts: new Date().toISOString()
    };

    // 🔥 CONTROL PLANE ACTION: register device state
    registry.registerDevice({
      id: msg.deviceId,
      type: msg.type,
      name: msg.deviceId,
      status: msg.status,
      last_seen: msg.ts
    });

    // log telemetry
    console.log("Telemetry:", msg);
  }, 4000);
}

function inferType(deviceId) {
  if (deviceId.includes("plug")) return "plug";
  if (deviceId.includes("thermo")) return "thermostat";
  if (deviceId.includes("sensor")) return "sensor";
  return "unknown";
}

// Optional: simple API server (control plane hook point)
const http = require("http");

function startAPI() {
  const server = http.createServer((req, res) => {
    if (req.url === "/devices") {
      const data = require("./registry/device-db").listDevices();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
      return;
    }

    res.writeHead(200);
    res.end("Edge Gateway Control Plane Running");
  });

  server.listen(3000, () => {
    console.log("API endpoint: http://localhost:3000/devices");
  });
}

startGateway();
startAPI();
