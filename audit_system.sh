#!/usr/bin/env bash

# Terminal text formatting variables
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0;0m' # No Color

echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}⚡ AESIRGRID SYSTEM SERVICE MESH ENGINE AUDIT RUNNER${NC}"
echo -e "${CYAN}====================================================${NC}"
echo ""

# 1. CHECK ENV VAULT PARAMS
echo -e "${YELLOW}[1/4] Scanning Environment Variables Vault File (.env)...${NC}"
ENV_FILE=~/tech-fusion-grid-ui/.env

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ FATAL: Local configuration file (.env) is missing at path.${NC}"
else
    echo -e "${GREEN}✔ Located local target configuration profile successfully.${NC}"
    
    # Safely probe flags without printing private API keys completely
    echo -e "   - Ingress Engine Port: $(grep PORT "$ENV_FILE" | cut -d'=' -f2)"
    echo -e "   - Target Pages Space : $(grep PAGES_PROJECT_NAME "$ENV_FILE" | cut -d'=' -f2)"
    
    if grep -q "WEBHOOK_SECRET" "$ENV_FILE"; then
        echo -e "${GREEN}   - Webhook Secret Match String Layer: PRESENT${NC}"
    else
        echo -e "${RED}   - Webhook Secret Match String Layer: ABSENT${NC}"
    fi
fi
echo ""

# 2. CHECK PM2 DEPLOYED PROCESS LIFE METRICS
echo -e "${YELLOW}[2/4] Evaluating Persistent Processing Layer States (PM2)...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ ERROR: PM2 supervisor instance is missing or not linked in path.${NC}"
else
    # Extract running apps status
    WORKER_STATUS=$(pm2 status | grep "aesirgrid-private-worker" | awk '{print $18}')
    DRIVER_STATUS=$(pm2 status | grep "aesirgrid-hardware-telemetry" | awk '{print $18}')
    
    pm2 status | grep -E "aesirgrid-private-worker|aesirgrid-hardware-telemetry"
    echo ""
fi

# 3. VERIFY LOCAL HARDWARE PORT ATTACHMENTS (MQTT Broker & Node Ingress)
echo -e "${YELLOW}[3/4] Verifying Networking Port Socket Infrastructure...${NC}"
if command -v netstat &> /dev/null; then
    echo "Checking listener bindings..."
    netstat -ant | grep -E "3050|1883"
elif command -v ss &> /dev/null; then
    echo "Checking listener bindings..."
    ss -ant | grep -E "3050|1883"
else
    echo -e "   - Port 3050 (Ingress Engine Node API) Ping Check:"
    (echo > /dev/tcp/127.0.0.1/3050) &>/dev/null && echo -e "${GREEN}     ✔ Port 3050 Online and Accepting Requests${NC}" || echo -e "${RED}     ❌ Port 3050 Closed/Offline${NC}"
    
    echo -e "   - Port 1883 (Local Mosquitto Message Broker) Ping Check:"
    (echo > /dev/tcp/127.0.0.1/1883) &>/dev/null && echo -e "${GREEN}     ✔ Port 1883 Online and Broadcasting Telemetry${NC}" || echo -e "${RED}     ❌ Port 1883 Closed/Offline${NC}"
fi
echo ""

# 4. DISK REPOSITORY DIRECTORY CHECK
echo -e "${YELLOW}[4/4] Confirming Temporary Storage and Sandbox Partition Paths...${NC}"
TMP_REPOS=~/tech-fusion-grid-ui/builds
if [ -d "$TMP_REPOS" ]; then
    ACTIVE_TEMPS=$(ls -A "$TMP_REPOS" | wc -l)
    echo -e "${GREEN}✔ Partition Path Exists.${NC}"
    echo -e "   - Ephemeral active workspace directories currently cached: ${ACTIVE_TEMPS}"
else
    echo -e "${RED}❌ Directory partition context mapping dropped or corrupted.${NC}"
fi

echo ""
echo -e "${CYAN}====================================================${NC}"
echo -e "${CYAN}Audit completed. Ensure Tunnel URL targets Ingress Port 3050.${NC}"
echo -e "${CYAN}====================================================${NC}"
