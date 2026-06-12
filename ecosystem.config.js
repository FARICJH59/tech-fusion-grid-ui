module.exports = {
  apps: [
    {
      name: "aesirgrid-foundry-core",
      script: "./server.js",
      cwd: "/data/data/com.termux/files/home/tech-fusion-grid-ui",
      watch: false,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production",
        PORT: 3050
      }
    },
    {
      name: "aesirgrid-mqtt-broker",
      script: "mosquitto",
      args: "-c /data/data/com.termux/files/home/tech-fusion-grid-ui/mosquitto.conf",
      exec_mode: "fork",
      max_memory_restart: "50M"
    }
  ]
};
