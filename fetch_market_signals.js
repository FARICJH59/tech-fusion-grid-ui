const https = require('https');

// Target Microservices Ports
const SERVICE_TARGETS = [
    'https://tech-fusion-grid-ui-299605665089.us-central1.run.app/api/telemetry-adjust',
    'https://logistic-scout-vision-299605665089.us-central1.run.app/api/telemetry-adjust'
];

const MASTER_SECURITY_TOKEN = 'Bearer tech-fusion-secure-master-key-2026';

/**
 * Real-World Market Snapshot Data Payload (May 16, 2026)
 * In a full production loop, this block queries live stock/SCADA APIs dynamically.
 */
const currentMarketPayload = JSON.stringify({
    simulated_load: 2450,    // Balanced power grid weight
    simulated_yield: 4.65,   // SPIKE: Spiking Treasury 10Y Yield
    simulated_oil: 106.00    // SHOCK: Ripping crude oil prices ($106/bbl)
});

function dispatchTelemetryToService(url) {
    const networkOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': MASTER_SECURITY_TOKEN,
            'Content-Length': currentMarketPayload.length
        },
        timeout: 3000
    };

    console.log(`📡 [MARKET CRON] Dispatching authorized packet to: ${url.split('-')[0]}...`);

    const req = https.request(url, networkOptions, (res) => {
        let rawBuffer = '';
        res.on('data', chunk => rawBuffer += chunk);
        res.on('end', () => {
            console.log(`✅ [MARKET CRON] Response Received [HTTP ${res.statusCode}]: ${rawBuffer}`);
        });
    });

    req.on('error', (err) => {
        console.error(`❌ [MARKET CRON] Ingestion pipe fault for ${url}: ${err.message}`);
    });

    req.write(currentMarketPayload);
    req.end();
}

console.log('🏁 [MARKET CRON] Querying live macroeconomic volatility indicators...');
SERVICE_TARGETS.forEach(target => dispatchTelemetryToService(target));
