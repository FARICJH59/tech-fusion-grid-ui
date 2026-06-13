// 📡 TECH FUSION AI/ML LLC - VIRTUAL DEVICE TWIN SIMULATOR
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

console.log('==== 🛰️ [HARDWARE SIMULATOR INITIALIZED] ====');
console.log('Streaming mock Raspberry Pi 5 kernel metrics onto Port 1883...');

client.on('connect', () => {
  setInterval(() => {
    // Math matrices to simulate natural fluctuating hardware heat loops
    const baseTemp = 48.2;
    const flux = Math.sin(Date.now() / 10000) * 8.5;
    const simulatedTemp = parseFloat((baseTemp + flux).toFixed(2));
    
    const simulatedCPU = parseFloat((Math.random() * 35 + 15).toFixed(1));

    const payload = {
      cpu_utilization: simulatedCPU,
      cluster_temp_c: simulatedTemp,
      virtual_twin: true,
      target_hardware: "Raspberry_Pi_5_8GB"
    };

    // Emit the payload straight into your live dashboard's ingress line
    client.publish('aesirgrid/devices/edge-node-01/telemetry', JSON.stringify(payload));
  }, 3000); // Emits perfectly in sync with your 3-second UI polling loops
});
