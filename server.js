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
let active_subscription_tier = "SaaS Edge Plan"; // Defaults to entry baseline

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
    history: historical_event_ledger,
    tier: active_subscription_tier
  });
});

app.post('/api/billing/checkout', (req, res) => {
  const { deposit_amount, selected_plan } = req.body;
  global_enterprise_balance = parseFloat(deposit_amount);
  active_subscription_tier = selected_plan || "SaaS Edge Plan";
  res.json({
    success: true,
    status: "BYOC_CONTRACT_TOKEN_VALIDATED",
    new_balance: global_enterprise_balance.toFixed(2),
    tier: active_subscription_tier,
    url: null 
  });
});
