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
