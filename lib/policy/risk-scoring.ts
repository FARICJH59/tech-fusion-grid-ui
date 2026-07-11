import type { CloudActionEvent, RiskLevel } from "@/lib/cloud/cloud-types";

const ORDER: RiskLevel[] = ["low", "medium", "high", "critical"];

export function compareRisk(left: RiskLevel, right: RiskLevel): number {
  return ORDER.indexOf(left) - ORDER.indexOf(right);
}

export function scoreActionRisk(event: Pick<CloudActionEvent, "riskLevel" | "reason">): {
  score: number;
  level: RiskLevel;
} {
  const levelBase: Record<RiskLevel, number> = {
    low: 20,
    medium: 50,
    high: 75,
    critical: 95,
  };

  const reasonWeight = event.reason.toLowerCase().includes("incident") ? 10 : 0;
  const score = Math.min(100, levelBase[event.riskLevel] + reasonWeight);

  if (score >= 90) return { score, level: "critical" };
  if (score >= 70) return { score, level: "high" };
  if (score >= 40) return { score, level: "medium" };
  return { score, level: "low" };
}
