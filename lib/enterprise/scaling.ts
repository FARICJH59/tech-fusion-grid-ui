import type { CostRecommendation } from "@/lib/enterprise/cost-engine";

export type CloudRunScalingPlan = {
  minInstances: number;
  maxInstances: number;
  concurrency: number;
  cpu: "1" | "2" | "4";
  memory: "512Mi" | "1Gi" | "2Gi" | "4Gi";
  region: string;
};

export class AutonomousScalingEngine {
  applyRecommendations(
    recommendations: CostRecommendation[],
    basePlan: CloudRunScalingPlan,
  ): CloudRunScalingPlan {
    return recommendations.reduce<CloudRunScalingPlan>((plan, recommendation) => {
      switch (recommendation.category) {
        case "cloud-run-concurrency":
          return {
            ...plan,
            concurrency: Math.min(200, Math.max(plan.concurrency, 80)),
            maxInstances: Math.max(plan.maxInstances, plan.minInstances + 2),
          };
        case "region-rightsizing":
          return {
            ...plan,
            region: "us-central1",
          };
        case "model-routing":
          return {
            ...plan,
            maxInstances: Math.max(plan.minInstances, plan.maxInstances - 1),
          };
        case "prompt-optimization":
          return {
            ...plan,
            cpu: "1",
            memory: "1Gi",
          };
        case "embedding-batching":
          return {
            ...plan,
            minInstances: Math.max(1, plan.minInstances - 1),
          };
        default:
          return plan;
      }
    }, basePlan);
  }
}

export const autonomousScalingEngine = new AutonomousScalingEngine();
