#!/bin/bash
URL="https://tech-fusion-grid-ui-299605665089.us-central1.run.app/api/metrics"

echo "===================================================="
echo "          TECH FUSION ESG INVESTMENT SUMMARY        "
echo "               REPORT GENERATED: $(date)            "
echo "===================================================="

curl -s $URL | node -e "
process.stdin.on('data', d => {
    const data = JSON.parse(d);
    console.log('--- GRID HEALTH PROFILE ---');
    console.log('Status Profile:      ' + data.grid_strain_level);
    console.log('Grid Demand Metric:  ' + data.national_grid_load_mw + ' MW');
    console.log('Active Pricing Mod:  +$' + data.active_surcharge_usd.toFixed(2));
    console.log('\n--- ENVIRONMENTAL REVENUE POTENTIAL ---');
    console.log('Carbon Saved Pool:   ' + data.carbon_saved_kg.toFixed(2) + ' kg CO2e');
    console.log('\n--- ESCROW BALANCES & DEPOSITS ---');
    for (let comp in data.active_wallets) {
        console.log(' Client ID:          ' + comp);
        console.log('   Available Escrow: $' + data.active_wallets[comp].balance.toFixed(2));
        console.log('   Scope 3 Burden:   ' + data.active_wallets[comp].cumulative_scope3_kg.toFixed(4) + ' kg');
    }
});"
echo "===================================================="
