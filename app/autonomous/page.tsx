/**
 * Autonomous Operations Dashboard — server component.
 */

import { runtimeSupervisor } from "@/lib/autonomous/supervisor";
import { fleetManager } from "@/lib/autonomous/fleet";
import { selfHealingEngine } from "@/lib/autonomous/healing";
import { complianceAutomation } from "@/lib/autonomous/compliance";
import { costOptimizationEngine } from "@/lib/autonomous/cost";

export default function AutonomousDashboard() {
  const supervisor = runtimeSupervisor.getHealthSummary();
  const fleet = fleetManager.getFleetHealth();
  const incidents = selfHealingEngine.getStats();
  const compliance = complianceAutomation.getComplianceSummary();
  const costRecs = costOptimizationEngine.getRecommendations();

  const sections = [
    { title: "Supervisor Health", data: supervisor },
    { title: "Fleet Health", data: fleet },
    { title: "Incident Stats", data: incidents },
    { title: "Compliance Summary", data: compliance },
    {
      title: "Cost Recommendations",
      data: { count: costRecs.length, recommendations: costRecs },
    },
  ];

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem", maxWidth: "960px", margin: "0 auto" }}>
      <h1>Autonomous Operations Dashboard</h1>
      <p style={{ color: "#666" }}>
        Phase 6 — Real-time status of autonomous systems
      </p>
      {sections.map((section) => (
        <section key={section.title} style={{ marginBottom: "2rem" }}>
          <h2 style={{ borderBottom: "1px solid #ccc", paddingBottom: "0.5rem" }}>
            {section.title}
          </h2>
          <pre
            style={{
              background: "#f4f4f4",
              padding: "1rem",
              borderRadius: "4px",
              overflow: "auto",
            }}
          >
            {JSON.stringify(section.data, null, 2)}
          </pre>
        </section>
      ))}
    </main>
  );
}
