const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '.')));

// Server-side database simulation states
let global_enterprise_balance = 0.00;
let total_carbon_mitigated = 0.00;
let historical_event_ledger = [];

const regionalGridSpecs = {
  PJM:   { rate: 0.375, currency: "$", co2_factor: 0.475, label: "USD" },
  ERCOT: { rate: 4.850, currency: "$", co2_factor: 0.520, label: "USD" },
  EMEA:  { rate: 0.145, currency: "€", co2_factor: 0.115, label: "EUR" },
  APAC:  { rate: 22.40, currency: "¥", co2_factor: 0.680, label: "JPY" }
};

app.get('/api/grid/status', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    telemetry: {
      cpu_utilization: (40 + Math.random() * 10).toFixed(1),
      cluster_temp_c: (55 + Math.random() * 5).toFixed(1),
      mqtt_broker_status: "online"
    }
  });
});

app.get('/api/grid/history', (req, res) => {
  res.json({
    success: true,
    balance: global_enterprise_balance.toFixed(2),
    total_co2: total_carbon_mitigated.toFixed(3),
    history: historical_event_ledger
  });
});

app.post('/api/billing/checkout', (req, res) => {
  const { deposit_amount } = req.body;
  global_enterprise_balance = parseFloat(deposit_amount);
  res.json({
    success: true,
    status: "BYOC_CONTRACT_TOKEN_VALIDATED",
    new_balance: global_enterprise_balance.toFixed(2),
    url: null 
  });
});

app.post('/api/grid/demand-response', (req, res) => {
  const { curtailed_kwh, region = "PJM" } = req.body;
  const spec = regionalGridSpecs[region] || regionalGridSpecs.PJM;
  
  const computed_payout = parseFloat((curtailed_kwh * spec.rate).toFixed(2));
  global_enterprise_balance += computed_payout;
  
  const log_entry = {
    id: "DR-" + Math.random().toString(36).substr(2, 5).toUpperCase(),
    timestamp: new Date().toLocaleTimeString(),
    type: "Curtailment",
    region: region,
    value: `${spec.currency}${computed_payout.toFixed(2)}`
  };
  historical_event_ledger.unshift(log_entry);
  
  res.json({
    success: true,
    status: `OPENADR_${region}_EVENT_CLEARED`,
    payout_amount: computed_payout.toFixed(2),
    currency_symbol: spec.currency,
    new_balance: global_enterprise_balance.toFixed(2),
    grid_timestamp: new Date().toISOString()
  });
});

app.post('/api/grid/battery-dispatch', (req, res) => {
  const { target_capacity_kwh, region = "PJM" } = req.body;
  const spec = regionalGridSpecs[region] || regionalGridSpecs.PJM;
  
  const soft_cost_reduction_multiplier = 0.15; 
  const optimization_savings = parseFloat((target_capacity_kwh * spec.rate * soft_cost_reduction_multiplier).toFixed(2));
  const carbon_offset = parseFloat((target_capacity_kwh * spec.co2_factor).toFixed(3));
  
  global_enterprise_balance += optimization_savings;
  total_carbon_mitigated += carbon_offset;
  
  const log_entry = {
    id: "BAT-" + Math.random().toString(36).substr(2, 5).toUpperCase(),
    timestamp: new Date().toLocaleTimeString(),
    type: "AI Optimization",
    region: region,
    value: `${spec.currency}${optimization_savings.toFixed(2)}`
  };
  historical_event_ledger.unshift(log_entry);
  
  res.json({
    success: true,
    status: "BATTERY_MATRIX_OPTIMIZED",
    savings_payout: optimization_savings.toFixed(2),
    currency_symbol: spec.currency,
    new_balance: global_enterprise_balance.toFixed(2),
    carbon_mitigated_kg: carbon_offset.toFixed(3)
  });
});

app.post('/api/agent/compile', (req, res) => {
  const { blueprint, target_cloud, github_repository } = req.body;
  res.json({
    success: true,
    blueprint_compiled: blueprint,
    egress_destination: target_cloud,
    isolated_build_logs: `Tree index from ${github_repository} packaged into container layers.`
  });
});

app.get('*', (pathReq, pathRes) => {
  pathRes.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Globalized VPP Engine Running on port: ${PORT}`);
});
