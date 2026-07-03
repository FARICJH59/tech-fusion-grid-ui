export type CarbonPayload = {
  company: string;
  sector: string;
  projectType: string;
  location: string;
};

export type CarbonPolicyStatus = "Compliant" | "Review Required";

export type CarbonToolResult = {
  score: number;
  feasibility: "High" | "Medium" | "Low";
  policyStatus: CarbonPolicyStatus;
  policyTracking: string[];
  marketSummary: string;
  complianceReport: {
    company: string;
    sector: string;
    projectType: string;
    location: string;
    recommendation: string;
  };
};

const sectorWeights: Record<string, number> = {
  forestry: 32,
  energy: 28,
  transport: 20,
  agriculture: 24,
  manufacturing: 18,
};

const projectWeights: Record<string, number> = {
  "redd+": 36,
  afforestation: 28,
  reforestation: 28,
  methane: 30,
  solar: 24,
  wind: 24,
  ccs: 20,
};

const locationWeights: Record<string, number> = {
  ghana: 18,
  kenya: 16,
  brazil: 20,
  indonesia: 18,
  india: 14,
};

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

function getFeasibility(score: number): "High" | "Medium" | "Low" {
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

export function scoreCarbonProject(payload: CarbonPayload): CarbonToolResult {
  const normalizedSector = payload.sector.trim().toLowerCase();
  const normalizedProjectType = payload.projectType.trim().toLowerCase();
  const normalizedLocation = payload.location.trim().toLowerCase();

  const score = clampScore(
    18 +
      (sectorWeights[normalizedSector] ?? 10) +
      (projectWeights[normalizedProjectType] ?? 10) +
      (locationWeights[normalizedLocation] ?? 8)
  );

  const feasibility = getFeasibility(score);
  const policyStatus: CarbonPolicyStatus =
    feasibility === "Low" ? "Review Required" : "Compliant";

  const policyTracking = [
    "Article 6 market eligibility screening",
    "Host country authorization check",
    "Registry integrity and double-counting controls",
    "MRV documentation completeness validation",
  ];

  const recommendation =
    feasibility === "High"
      ? "Proceed to baseline modeling and registry pre-submission."
      : feasibility === "Medium"
      ? "Complete policy gap review before full submission."
      : "Address critical policy and feasibility risks before submission.";

  return {
    score,
    feasibility,
    policyStatus,
    policyTracking,
    marketSummary: `${payload.projectType} in ${payload.location} for the ${payload.sector} sector shows ${feasibility.toLowerCase()} feasibility.`,
    complianceReport: {
      company: payload.company,
      sector: payload.sector,
      projectType: payload.projectType,
      location: payload.location,
      recommendation,
    },
  };
}
