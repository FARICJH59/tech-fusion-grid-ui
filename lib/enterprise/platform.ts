import {
  buildDefaultControlPlane,
  CONTROL_PLANE_MODULES,
} from "@/lib/enterprise/control-plane";
import { createGoogleCloudProfile, GOOGLE_CLOUD_SERVICES } from "@/lib/enterprise/cloud";
import { createDefaultAgentFramework, AGENT_FRAMEWORK_FEATURES } from "@/lib/enterprise/agents";
import { createDefaultInfrastructure, INFRA_COMPONENTS } from "@/lib/enterprise/infrastructure";
import { createDefaultMarketplace, MARKETPLACE_EXTENSION_TYPES } from "@/lib/enterprise/marketplace";
import { createAIProviderGateway, PROVIDER_NAMES } from "@/lib/enterprise/providers";
import { RevenuePlatform, REVENUE_FEATURES } from "@/lib/enterprise/revenue";
import { EnterpriseSecurity, SECURITY_CAPABILITIES } from "@/lib/enterprise/security";
import { createDefaultSDKRegistry, SDK_CHANNELS } from "@/lib/enterprise/sdk";
import { RuntimeIntegration, RUNTIME_SERVICES } from "@/lib/enterprise/runtime";
import { alertManager, ALERT_CHANNELS } from "@/lib/enterprise/alerts";
import { costOptimizationEngine } from "@/lib/enterprise/cost-engine";
import { createDefaultFleetManager } from "@/lib/enterprise/fleet";
import { createDefaultIntegrationLayer, ENTERPRISE_CONNECTORS } from "@/lib/enterprise/integrations";
import { EnterpriseMessagingRuntime, MQTT_HARDENING_FEATURES } from "@/lib/enterprise/messaging";
import { policyEngine, POLICY_TYPES } from "@/lib/enterprise/policy-engine";
import { REDIS_RUNTIME_CAPABILITIES, RUNTIME_STATE_ENTITIES } from "@/lib/enterprise/runtime-state";
import { autonomousScalingEngine } from "@/lib/enterprise/scaling";
import { DEFAULT_POLICY_RULES } from "@/lib/policy/rules";

export class HoareEnterprisePlatform {
  readonly controlPlane = buildDefaultControlPlane();
  readonly runtime = new RuntimeIntegration();
  readonly providers = createAIProviderGateway();
  readonly infrastructure = createDefaultInfrastructure();
  readonly agents = createDefaultAgentFramework();
  readonly cloud = createGoogleCloudProfile();
  readonly sdk = createDefaultSDKRegistry();
  readonly marketplace = createDefaultMarketplace();
  readonly security = new EnterpriseSecurity();
  readonly revenue = new RevenuePlatform();
  readonly messaging = new EnterpriseMessagingRuntime();
  readonly fleet = createDefaultFleetManager();
  readonly integrations = createDefaultIntegrationLayer();
  readonly policy = policyEngine;
  readonly alerts = alertManager;
  readonly cost = costOptimizationEngine;
  readonly scaling = autonomousScalingEngine;

  status() {
    return {
      architecture: {
        controlPlaneModules: CONTROL_PLANE_MODULES,
        runtimeServices: RUNTIME_SERVICES,
        providers: PROVIDER_NAMES,
        infrastructure: INFRA_COMPONENTS,
        agentFeatures: AGENT_FRAMEWORK_FEATURES,
        googleCloud: GOOGLE_CLOUD_SERVICES,
        sdkChannels: SDK_CHANNELS,
        marketplaceExtensionTypes: MARKETPLACE_EXTENSION_TYPES,
        securityCapabilities: SECURITY_CAPABILITIES,
        revenueFeatures: REVENUE_FEATURES,
        runtimeStateEntities: RUNTIME_STATE_ENTITIES,
        redisCapabilities: REDIS_RUNTIME_CAPABILITIES,
        mqttReadiness: MQTT_HARDENING_FEATURES,
        policyTypes: POLICY_TYPES,
        notificationChannels: ALERT_CHANNELS,
        multiRegion: this.fleet.snapshot().map((item) => item.region),
        integrationConnectors: ENTERPRISE_CONNECTORS,
        autonomousCloudControl: [
          "cloud-run-controller",
          "deployment-manager",
          "scaling-engine",
          "rollback-engine",
        ],
        secretVaultProviders: [
          "gcp-secret-manager",
          "vault-compatible",
          "aws-secrets-manager",
          "azure-key-vault",
        ],
        governancePolicies: DEFAULT_POLICY_RULES.map((rule) => rule.id),
      },
      health: {
        controlPlane: this.controlPlane.snapshotHealth(),
        runtime: this.runtime.getHealth(),
      },
      cloud: this.cloud,
    };
  }
}

export const hoareEnterprisePlatform = new HoareEnterprisePlatform();
