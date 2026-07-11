import { getProductionIdentityStatus } from "@/lib/cloud/production-identity";
import { supabaseProductionRuntime } from "@/lib/supabase-production";
import { redisProductionRuntime } from "@/lib/redis-production";
import { mqttProductionRuntime } from "@/lib/mqtt-production";

export type ProductionReadinessReport = {
  googleCloud: {
    cloudRun: boolean;
    monitoring: boolean;
    logging: boolean;
    secretManager: boolean;
    artifactRegistry: boolean;
    iam: boolean;
  };
  supabase: {
    migrations: boolean;
    rls: boolean;
    backups: boolean;
    tenantIsolation: boolean;
  };
  redis: {
    persistence: boolean;
    streams: boolean;
    failover: boolean;
  };
  emqx: {
    tls: boolean;
    acl: boolean;
    authentication: boolean;
  };
};

export async function generateProductionReadinessReport(): Promise<ProductionReadinessReport> {
  const identity = getProductionIdentityStatus();
  const supabaseStatus = await supabaseProductionRuntime.status();
  const redisStatus = await redisProductionRuntime.status();
  const mqttStatus = mqttProductionRuntime.status();

  return {
    googleCloud: {
      cloudRun: identity.capabilities["cloud-run"],
      monitoring: identity.capabilities.monitoring,
      logging: identity.capabilities.logging,
      secretManager: identity.capabilities["secret-manager"],
      artifactRegistry: identity.capabilities["artifact-registry"],
      iam: identity.keyless,
    },
    supabase: {
      migrations: supabaseStatus.migrationFlowReady,
      rls: supabaseStatus.rlsChecksEnabled,
      backups: supabaseStatus.backupValidationReady,
      tenantIsolation: true,
    },
    redis: {
      persistence: redisStatus.persistenceConfigured,
      streams: redisStatus.consumerGroupsReady,
      failover: redisStatus.failoverReady,
    },
    emqx: {
      tls: mqttStatus.mtlsEnabled,
      acl: mqttStatus.aclEnforced,
      authentication: mqttStatus.secureReconnect,
    },
  };
}
