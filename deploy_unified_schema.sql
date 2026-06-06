-- Upgraded Unified Corporate Accounts Ledger
CREATE TABLE IF NOT EXISTS corporate_wallets (
    company_id VARCHAR(100) PRIMARY KEY,
    prepaid_balance_usd NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    cumulative_scope3_co2_kg NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    max_yield_tolerance NUMERIC(4, 2) NOT NULL DEFAULT 4.50,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Upgraded Unified Telemetry Infrastructure & Volatility Audit Table
CREATE TABLE IF NOT EXISTS unified_system_telemetry (
    log_id BIGSERIAL PRIMARY KEY,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    grid_strain_status VARCHAR(20) NOT NULL,    -- OPTIMAL, CRITICAL
    national_load_mw INT NOT NULL,              -- Telemetry from Utility
    treasury_10y_yield NUMERIC(4, 2) NOT NULL,   -- Telemetry from Markets
    crude_oil_price_usd NUMERIC(6, 2) NOT NULL, -- Telemetry from Commodities
    active_tariff_surcharge NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    system_action_executed VARCHAR(120) NOT NULL
);

-- Seed Combined Client Portfolios
INSERT INTO corporate_wallets (company_id, prepaid_balance_usd, cumulative_scope3_co2_kg, max_yield_tolerance)
VALUES 
('TEMA-PORT-AUTHORITY', 125000.00, 45.8500, 4.50),
('ALPHA-QUANT-HEDGE', 25000000.00, 12.4480, 4.60)
ON CONFLICT (company_id) DO NOTHING;
