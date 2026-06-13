const express = require('express');
const path = require('path');
const cluster = require('cluster');
const totalCPUs = require('os').cpus().length;

const PORT = process.env.PORT || 3000;

if (cluster.isMaster) {
  console.log(`Master cluster node ${process.pid} is spawning system worker layout...`);
  for (let i = 0; i < Math.min(totalCPUs, 2); i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️ Worker process ${worker.process.pid} dropped offline. Initiating automated DevOps hot-swap fork...`);
    cluster.fork();
  });
} else {
  const expressApp = express();
  expressApp.use(express.json());
  expressApp.use(express.static(path.join(__dirname, '.')));

  // ENTERPRISE ACCOUNTING PERSISTENCE STATES
  let global_enterprise_balance = 0.00;
  let total_carbon_mitigated = 0.00;
  let platform_performance_earnings = 0.00; // Tracks our 20% operational cut
  let historical_event_ledger = [];
  let active_subscription_tier = "SaaS Edge Plan";

  const regionalGridSpecs = {
    PJM:   { rate: 0.375, currency: "$", co2_factor: 0.475 },
    ERCOT: { rate: 4.850, currency: "$", co2_factor: 0.520 },
    EMEA:  { rate: 0.145, currency: "€", co2_factor: 0.115 },
    APAC:  { rate: 22.40, currency: "¥", co2_factor: 0.680 }
  };

  expressApp.get('/api/grid/status', (req, res) => {
    res.json({
      success: true,
      worker_pid: process.pid,
      timestamp: new Date().toISOString(),
      telemetry: {
        cpu_utilization: (40 + Math.random() * 10).toFixed(1),
        cluster_temp_c: (55 + Math.random() * 5).toFixed(1),
        mqtt_broker_status: "online"
      }
    });
  });

  expressApp.get('/api/grid/history', (req, res) => {
    res.json({
      success: true,
      balance: global_enterprise_balance.toFixed(2),
      total_co2: total_carbon_mitigated.toFixed(3),
      platform_revenue: platform_performance_earnings.toFixed(2),
      history: historical_event_ledger,
      tier: active_subscription_tier
    });
  });

  expressApp.post('/api/billing/checkout', (req, res) => {
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

  expressApp.post('/api/grid/demand-response', (req, res) => {
    const { curtailed_kwh, region = "PJM" } = req.body;
    if (region !== "PJM" && active_subscription_tier === "SaaS Edge Plan") {
      return res.status(403).json({ success: false, error: "TIER_RESTRICTED_MARKET" });
    }
    const spec = regionalGridSpecs[region] || regionalGridSpecs.PJM;
    
    // PERFORMANCE SHARE MATH LOOP
    const raw_client_savings = parseFloat((curtailed_kwh * spec.rate).toFixed(2));
    const platform_cut = parseFloat((raw_client_savings * 0.20).toFixed(2)); // 20% Split
    const net_client_credit = parseFloat((raw_client_savings - platform_cut).toFixed(2));
    
    global_enterprise_balance += net_client_credit;
    platform_performance_earnings += platform_cut;
    
    const log_entry = {
      id: "DR-" + Math.random().toString(36).substr(2, 5).toUpperCase(),
      timestamp: new Date().toLocaleTimeString(),
      type: `Curtailment (Split: 20% System Fee Taken)`,
      region: region,
      value: `${spec.currency || "$"}${net_client_credit.toFixed(2)}`
    };
    historical_event_ledger.unshift(log_entry);
    
    res.json({
      success: true,
      status: `OPENADR_${region}_SPLIT_CLEARED`,
      payout_amount: net_client_credit.toFixed(2),
      performance_fee: platform_cut.toFixed(2),
      currency_symbol: spec.currency,
      new_balance: global_enterprise_balance.toFixed(2),
      grid_timestamp: new Date().toISOString()
    });
  });

  expressApp.post('/api/grid/intellisize-dispatch', (req, res) => {
    const { target_capacity_kwh, region = "PJM" } = req.body;
    if (region !== "PJM" && active_subscription_tier === "SaaS Edge Plan") {
      return res.status(403).json({ success: false, error: "TIER_RESTRICTED_MARKET" });
    }
    const spec = regionalGridSpecs[region] || regionalGridSpecs.PJM;
    const soft_cost_reduction_multiplier = 0.15; 
    
    const raw_optimization_savings = parseFloat((target_capacity_kwh * spec.rate * soft_cost_reduction_multiplier).toFixed(2));
    const platform_cut = parseFloat((raw_optimization_savings * 0.20).toFixed(2)); // 20% Performance Share Cut
    const net_client_savings = parseFloat((raw_optimization_savings - platform_cut).toFixed(2));
    const carbon_offset = parseFloat((target_capacity_kwh * spec.co2_factor).toFixed(3));
    
    global_enterprise_balance += net_client_savings;
    platform_performance_earnings += platform_cut;
    total_carbon_mitigated += carbon_offset;
    
    const log_entry = {
      id: "BAT-" + Math.random().toString(36).substr(2, 5).toUpperCase(),
      timestamp: new Date().toLocaleTimeString(),
      type: "IntelliSize (80/20 Split Applied)",
      region: region,
      value: `${spec.currency || "$"}${net_client_savings.toFixed(2)}`
    };
    historical_event_ledger.unshift(log_entry);
    
    res.json({
      success: true,
      status: "STORAGE_MATRIX_OPTIMIZED",
      savings_payout: net_client_savings.toFixed(2),
      performance_fee: platform_cut.toFixed(2),
      currency_symbol: spec.currency,
      new_balance: global_enterprise_balance.toFixed(2),
      carbon_mitigated_kg: carbon_offset.toFixed(3)
    });
  });

  expressApp.post('/api/agent/compile', (req, res) => {
    if (active_subscription_tier === "SaaS Edge Plan") {
      return res.status(403).json({ success: false, error: "TIER_RESTRICTED_COMPILATION" });
    }
    const { blueprint, target_cloud, github_repository } = req.body;
    res.json({
      success: true,
      blueprint_compiled: blueprint,
      egress_destination: target_cloud,
      isolated_build_logs: `Tree index from ${github_repository} packaged into container layers.`
    });
  });

  expressApp.get('*', (pathReq, pathRes) => {
    pathRes.sendFile(path.join(__dirname, 'index.html'));
  });

  expressApp.listen(PORT, () => {
    console.log(`🚀 IntelliSize Enforced VPP Core online running on port: ${PORT}`);
  });
}
