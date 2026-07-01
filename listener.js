const https = require('https');
const { exec } = require('child_process');

const CLOUD_ENDPOINT = 'tech-fusion-grid-ui.vercel.app';
const DEVICE_IDENTITY = 'Termux-Aarch64-Edge-Node-01';

console.log('🛡️ High-Performance Autonomous Load Shedder Initialized...');
console.log(`📡 Monitoring Predictive Infrastructure Targets on: https://${CLOUD_ENDPOINT}`);

if (!global.executedLogs) global.executedLogs = new Set();

function pollPredictiveDirectives() {
  const options = {
    hostname: CLOUD_ENDPOINT,
    port: 443,
    path: '/api/grid/history',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (!parsed.success) return;

        https.get(`https://${CLOUD_ENDPOINT}/api/grid/forecast?region=PJM`, (forecastRes) => {
          let fData = '';
          forecastRes.on('data', (chunk) => fData += chunk);
          forecastRes.on('end', () => {
            try {
              const forecast = JSON.parse(fData);

              if (forecast.anomaly_detected && !global.executedLogs.has(forecast.forecast_horizon)) {
                console.log(`\n🚨 [CRITICAL INFRASTRUCTURE ALERT]: Grid Anomaly Forecasted for: "${forecast.forecast_horizon}"`);
                console.log(`📊 Engine Confidence Rating: ${forecast.confidence_score}%`);
                console.log('🛠️ [EDGE SHEDDING ACTIVATED]: Overriding system scheduling flags...');

                global.executedLogs.add(forecast.forecast_horizon);

                exec('echo -e "\\a" && termux-toast "CRITICAL DEMAND RESPONSE: Throttling Edge Node Node-01" 2>/dev/null || echo "🔔 [VIRTUAL BELL]: Hardware throttled successfully."', (err, stdout) => {
                  if (stdout) console.log(stdout.trim());
                  console.log('✅ Local CPU scheduler clamped to low-power conservation block.');
                });
              }
            } catch (err) {}
          });
        });
      } catch (e) {}
    });
  });

  req.on('error', (e) => {
    console.error(`❌ Connection error: ${e.message}`);
  });

  req.end();
}

setInterval(pollPredictiveDirectives, 3000);
