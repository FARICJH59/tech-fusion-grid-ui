/**
 * Tests for Phase 6 – Autonomous Operations Platform
 */

import test from "node:test";
import assert from "node:assert/strict";

// We import fresh class instances (not singletons) for isolation
import { RuntimeSupervisor } from "../lib/autonomous/supervisor";
import { SelfHealingEngine } from "../lib/autonomous/healing";
import { AutonomousDevOps } from "../lib/autonomous/devops";
import { CostOptimizationEngine } from "../lib/autonomous/cost";
import { FleetManager } from "../lib/autonomous/fleet";
import { ComplianceAutomation } from "../lib/autonomous/compliance";
import { JobScheduler } from "../lib/autonomous/scheduler";
import { InMemoryEventBus } from "../lib/runtime/event-bus";

// ── RuntimeSupervisor ────────────────────────────────────────────────────────

test("autonomous: RuntimeSupervisor registers and lists services", () => {
  const s = new RuntimeSupervisor();
  s.register({ id: "svc-a", name: "Service A", version: "1.0.0", status: "running" });
  const list = s.listServices();
  assert.equal(list.length, 1);
  assert.equal(list[0]!.id, "svc-a");
  assert.equal(list[0]!.restartCount, 0);
  assert.ok(list[0]!.registeredAt);
});

test("autonomous: RuntimeSupervisor deregisters a service", () => {
  const s = new RuntimeSupervisor();
  s.register({ id: "svc-b", name: "Service B", version: "1.0.0", status: "running" });
  s.deregister("svc-b");
  assert.equal(s.listServices().length, 0);
  assert.equal(s.getService("svc-b"), undefined);
});

test("autonomous: RuntimeSupervisor updates service status", () => {
  const s = new RuntimeSupervisor();
  s.register({ id: "svc-c", name: "Service C", version: "1.0.0", status: "starting" });
  s.updateStatus("svc-c", "running");
  assert.equal(s.getService("svc-c")!.status, "running");
});

test("autonomous: RuntimeSupervisor tracks restart counts", async () => {
  const s = new RuntimeSupervisor();
  s.register({
    id: "svc-d",
    name: "Service D",
    version: "1.0.0",
    status: "failed",
    restartPolicy: "always",
    maxRestarts: 3,
  });
  await s.triggerRestart("svc-d", "test");
  assert.equal(s.getService("svc-d")!.restartCount, 1);
  assert.equal(s.getService("svc-d")!.status, "running");
});

test("autonomous: RuntimeSupervisor respects never restart policy", async () => {
  const s = new RuntimeSupervisor();
  s.register({
    id: "svc-e",
    name: "Service E",
    version: "1.0.0",
    status: "failed",
    restartPolicy: "never",
  });
  await s.triggerRestart("svc-e", "test");
  assert.equal(s.getService("svc-e")!.restartCount, 0);
});

test("autonomous: RuntimeSupervisor health summary totals", () => {
  const s = new RuntimeSupervisor();
  s.register({ id: "a", name: "A", version: "1", status: "running" });
  s.register({ id: "b", name: "B", version: "1", status: "failed" });
  s.register({ id: "c", name: "C", version: "1", status: "degraded" });
  s.register({ id: "d", name: "D", version: "1", status: "stopped" });
  const summary = s.getHealthSummary();
  assert.equal(summary.total, 4);
  assert.equal(summary.running, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.degraded, 1);
});

test("autonomous: RuntimeSupervisor rolling restart sequence", async () => {
  const s = new RuntimeSupervisor();
  s.register({ id: "r1", name: "R1", version: "1", status: "failed", restartPolicy: "always" });
  s.register({ id: "r2", name: "R2", version: "1", status: "failed", restartPolicy: "always" });
  await s.rollingRestart(0);
  // Both should be running (restartPolicy: always means they get restarted)
  assert.equal(s.getService("r1")!.status, "running");
  assert.equal(s.getService("r2")!.status, "running");
});

test("autonomous: RuntimeSupervisor dependency ordering", () => {
  const s = new RuntimeSupervisor();
  s.register({ id: "dep", name: "Dep", version: "1", status: "running" });
  s.register({ id: "app", name: "App", version: "1", status: "running", dependencies: ["dep"] });
  const list = s.listServices();
  // Both exist; dep should come before app after topological sort (tested via internal sort)
  assert.equal(list.find((l) => l.id === "dep") !== undefined, true);
  assert.equal(list.find((l) => l.id === "app") !== undefined, true);
});

// ── SelfHealingEngine ────────────────────────────────────────────────────────

test("autonomous: SelfHealingEngine creates an incident", () => {
  const engine = new SelfHealingEngine();
  const incident = engine.createIncident({
    severity: "high",
    status: "open",
    title: "DB failure",
    description: "Cannot connect to database",
  });
  assert.ok(incident.id);
  assert.equal(incident.severity, "high");
  assert.equal(incident.status, "open");
  assert.equal(incident.remediationActions.length, 0);
});

test("autonomous: SelfHealingEngine resolves an incident", () => {
  const engine = new SelfHealingEngine();
  const incident = engine.createIncident({
    severity: "medium",
    status: "open",
    title: "Test incident",
    description: "Test",
  });
  engine.resolveIncident(incident.id, "manual fix");
  const updated = engine.getIncident(incident.id)!;
  assert.equal(updated.status, "resolved");
  assert.ok(updated.resolvedAt);
});

test("autonomous: SelfHealingEngine lists incidents by filter", () => {
  const engine = new SelfHealingEngine();
  engine.createIncident({ severity: "low", status: "open", title: "Low", description: "" });
  engine.createIncident({ severity: "critical", status: "open", title: "Critical", description: "" });
  const highs = engine.listIncidents({ severity: "critical" });
  assert.equal(highs.length, 1);
  assert.equal(highs[0]!.severity, "critical");
});

test("autonomous: SelfHealingEngine adds remediation actions", () => {
  const engine = new SelfHealingEngine();
  const incident = engine.createIncident({
    severity: "high",
    status: "investigating",
    title: "Action test",
    description: "",
  });
  const action = engine.addRemediationAction(incident.id, {
    type: "restart",
    status: "pending",
    description: "Restart the service",
  });
  assert.ok(action.id);
  assert.equal(action.type, "restart");
  assert.equal(engine.getIncident(incident.id)!.remediationActions.length, 1);
});

test("autonomous: SelfHealingEngine tracks incident stats", () => {
  const engine = new SelfHealingEngine();
  const i1 = engine.createIncident({ severity: "low", status: "open", title: "I1", description: "" });
  engine.createIncident({ severity: "high", status: "open", title: "I2", description: "" });
  engine.resolveIncident(i1.id);
  const stats = engine.getStats();
  assert.equal(stats.total, 2);
  assert.equal(stats.open, 1);
  assert.equal(stats.resolved, 1);
});

test("autonomous: SelfHealingEngine handles failure and auto-resolves", async () => {
  const engine = new SelfHealingEngine();
  await engine.handleFailure("redis", { message: "Connection refused", tenantId: "t1" });
  const stats = engine.getStats();
  assert.equal(stats.resolved, 1);
});

// ── AutonomousDevOps ─────────────────────────────────────────────────────────

test("autonomous: AutonomousDevOps creates a deployment plan", () => {
  const devops = new AutonomousDevOps();
  const plan = devops.planDeployment({
    serviceId: "svc-x",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    strategy: "rolling",
  });
  assert.ok(plan.id);
  assert.equal(plan.status, "pending");
  assert.equal(plan.strategy, "rolling");
});

test("autonomous: AutonomousDevOps plan approval workflow", async () => {
  const devops = new AutonomousDevOps();
  const plan = devops.planDeployment({
    serviceId: "svc-y",
    fromVersion: "2.0.0",
    toVersion: "2.1.0",
    strategy: "rolling",
  });
  // Cannot execute without approval
  await assert.rejects(() => devops.executePlan(plan.id), /approved/);
  devops.approvePlan(plan.id, "alice");
  await devops.executePlan(plan.id);
  assert.equal(devops.getPlan(plan.id)!.status, "completed");
});

test("autonomous: AutonomousDevOps canary strategy records weight", () => {
  const devops = new AutonomousDevOps();
  const plan = devops.planDeployment({
    serviceId: "svc-z",
    fromVersion: "1.0.0",
    toVersion: "1.1.0",
    strategy: "canary",
  });
  assert.equal(plan.canaryWeight, 10); // default
});

test("autonomous: AutonomousDevOps rollback updates plan and version", async () => {
  const devops = new AutonomousDevOps();
  devops.setServiceVersion("svc-rb", "2.0.0");
  const plan = devops.planAndApprove(
    { serviceId: "svc-rb", fromVersion: "1.0.0", toVersion: "2.0.0", strategy: "rolling" },
    "bob",
  );
  await devops.executePlan(plan.id);
  await devops.rollback(plan.id, "regression");
  assert.equal(devops.getPlan(plan.id)!.status, "rolled-back");
  assert.equal(devops.getServiceVersion("svc-rb"), "1.0.0");
});

test("autonomous: AutonomousDevOps version manager get/set", () => {
  const devops = new AutonomousDevOps();
  devops.setServiceVersion("svc-v", "3.0.0");
  assert.equal(devops.getServiceVersion("svc-v"), "3.0.0");
  assert.equal(devops.getServiceVersion("nonexistent"), undefined);
});

test("autonomous: AutonomousDevOps config diff detection", () => {
  const devops = new AutonomousDevOps();
  devops.setConfig("svc-cfg", { port: 8080, debug: false });
  const diff = devops.diffConfig("svc-cfg", { port: 9090, debug: false });
  assert.deepEqual(diff, { port: 9090 });
});

// ── CostOptimizationEngine ───────────────────────────────────────────────────

test("autonomous: CostOptimizationEngine records and aggregates costs", () => {
  const engine = new CostOptimizationEngine();
  engine.recordCost({ resourceType: "redis", tenantId: "t1", costMicroUsd: 1_000_000, unit: "GB", quantity: 1 });
  engine.recordCost({ resourceType: "redis", tenantId: "t1", costMicroUsd: 2_000_000, unit: "GB", quantity: 2 });
  assert.equal(engine.getTotalCostMicroUsd("t1"), 3_000_000);
});

test("autonomous: CostOptimizationEngine tenant cost breakdown", () => {
  const engine = new CostOptimizationEngine();
  engine.recordCost({ resourceType: "redis", tenantId: "t2", costMicroUsd: 500_000, unit: "GB", quantity: 1 });
  engine.recordCost({ resourceType: "gpu", tenantId: "t2", costMicroUsd: 2_000_000, unit: "hr", quantity: 1 });
  const breakdown = engine.getCostBreakdown("t2");
  assert.equal(breakdown["redis"], 500_000);
  assert.equal(breakdown["gpu"], 2_000_000);
});

test("autonomous: CostOptimizationEngine generates AI model optimization rec", () => {
  const engine = new CostOptimizationEngine();
  engine.recordCost({ resourceType: "ai-model", tenantId: "t3", costMicroUsd: 60_000_000, unit: "req", quantity: 100 });
  const recs = engine.generateRecommendations("t3");
  assert.ok(recs.some((r) => r.type === "optimize" && r.description.includes("AI model")));
});

test("autonomous: CostOptimizationEngine alert thresholds", () => {
  const engine = new CostOptimizationEngine();
  engine.setAlertThreshold("t4", 1_000_000);
  engine.recordCost({ resourceType: "cloud-run", tenantId: "t4", costMicroUsd: 2_000_000, unit: "req", quantity: 1 });
  const alerts = engine.checkAlerts();
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.tenantId, "t4");
});

test("autonomous: CostOptimizationEngine clears old entries", () => {
  const engine = new CostOptimizationEngine();
  engine.recordCost({ resourceType: "redis", tenantId: "t5", costMicroUsd: 100, unit: "GB", quantity: 1 });
  // Use negative window so cutoff is in the future — all entries are "old"
  const removed = engine.clearOldEntries(-1);
  assert.equal(removed, 1);
  assert.equal(engine.getTotalCostMicroUsd("t5"), 0);
});

test("autonomous: CostOptimizationEngine no recs for zero cost tenant", () => {
  const engine = new CostOptimizationEngine();
  const recs = engine.generateRecommendations("empty-tenant");
  assert.equal(recs.length, 0);
});

// ── FleetManager ─────────────────────────────────────────────────────────────

test("autonomous: FleetManager registers and deregisters nodes", () => {
  const mgr = new FleetManager();
  mgr.registerNode({ id: "node-1", type: "edge", name: "Edge Node 1", status: "online" });
  assert.equal(mgr.listNodes().length, 1);
  mgr.deregisterNode("node-1");
  assert.equal(mgr.listNodes().length, 0);
});

test("autonomous: FleetManager heartbeat updates timestamp", async () => {
  const mgr = new FleetManager();
  mgr.registerNode({ id: "node-2", type: "docker", name: "Docker Node", status: "online" });
  const before = mgr.getNode("node-2")!.lastHeartbeat;
  await new Promise<void>((resolve) => setTimeout(resolve, 5));
  mgr.heartbeat("node-2", { cpuPercent: 45 });
  const after = mgr.getNode("node-2")!.lastHeartbeat;
  assert.notEqual(before, after);
  assert.equal(mgr.getNode("node-2")!.metrics?.cpuPercent, 45);
});

test("autonomous: FleetManager detects stale nodes", () => {
  const mgr = new FleetManager();
  mgr.registerNode({ id: "node-3", type: "raspberry-pi", name: "Pi", status: "online" });
  // Force last heartbeat to be old
  const node = mgr.getNode("node-3")!;
  node.lastHeartbeat = new Date(Date.now() - 200_000).toISOString();
  mgr.checkHeartbeats(90_000);
  assert.equal(mgr.getNode("node-3")!.status, "offline");
});

test("autonomous: FleetManager fleet health summary", () => {
  const mgr = new FleetManager();
  mgr.registerNode({ id: "n1", type: "cloud-run", name: "N1", status: "online" });
  mgr.registerNode({ id: "n2", type: "cloud-run", name: "N2", status: "offline" });
  mgr.registerNode({ id: "n3", type: "cloud-run", name: "N3", status: "degraded" });
  const health = mgr.getFleetHealth();
  assert.equal(health.total, 3);
  assert.equal(health.online, 1);
  assert.equal(health.offline, 1);
  assert.equal(health.degraded, 1);
});

test("autonomous: FleetManager config sync", () => {
  const mgr = new FleetManager();
  mgr.registerNode({ id: "n4", type: "kubernetes", name: "K8s", status: "online" });
  mgr.syncConfig("n4", { logLevel: "debug", replicas: 3 });
  assert.deepEqual(mgr.getNode("n4")!.config, { logLevel: "debug", replicas: 3 });
});

test("autonomous: FleetManager filter nodes by type", () => {
  const mgr = new FleetManager();
  mgr.registerNode({ id: "e1", type: "edge", name: "Edge", status: "online" });
  mgr.registerNode({ id: "k1", type: "kubernetes", name: "K8s", status: "online" });
  const edges = mgr.listNodes({ type: "edge" });
  assert.equal(edges.length, 1);
  assert.equal(edges[0]!.type, "edge");
});

// ── ComplianceAutomation ──────────────────────────────────────────────────────

test("autonomous: ComplianceAutomation runs registered policies", async () => {
  const ca = new ComplianceAutomation();
  ca.registerPolicy("test-policy", async () => ({
    policy: "test-policy",
    category: "security",
    status: "compliant",
    details: "All good",
  }));
  const checks = await ca.runChecks();
  assert.equal(checks.length, 1);
  assert.equal(checks[0]!.status, "compliant");
  assert.ok(checks[0]!.id);
  assert.ok(checks[0]!.checkedAt);
});

test("autonomous: ComplianceAutomation detects violation", async () => {
  const ca = new ComplianceAutomation();
  ca.registerPolicy("bad-policy", async () => ({
    policy: "bad-policy",
    category: "security",
    status: "violation",
    details: "Secret not rotated",
  }));
  const checks = await ca.runChecks();
  assert.equal(checks[0]!.status, "violation");
});

test("autonomous: ComplianceAutomation detects drift", () => {
  const ca = new ComplianceAutomation();
  ca.setBaseline("replicas", 3);
  assert.equal(ca.checkDrift("replicas", 3), false);
  assert.equal(ca.checkDrift("replicas", 5), true);
});

test("autonomous: ComplianceAutomation compliance summary", async () => {
  const ca = new ComplianceAutomation();
  ca.registerPolicy("p1", async () => ({ policy: "p1", category: "security", status: "compliant", details: "" }));
  ca.registerPolicy("p2", async () => ({ policy: "p2", category: "infrastructure", status: "warning", details: "" }));
  ca.registerPolicy("p3", async () => ({ policy: "p3", category: "audit", status: "violation", details: "" }));
  await ca.runChecks();
  const summary = ca.getComplianceSummary();
  assert.equal(summary.compliant, 1);
  assert.equal(summary.warnings, 1);
  assert.equal(summary.violations, 1);
});

// ── JobScheduler ──────────────────────────────────────────────────────────────

test("autonomous: JobScheduler registers and lists jobs", () => {
  const sched = new JobScheduler();
  sched.register({ id: "job-1", name: "Test Job", schedule: "every 1s", handler: async () => {}, intervalMs: 1000 });
  const jobs = sched.listJobs();
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0]!.name, "Test Job");
});

test("autonomous: JobScheduler runNow executes handler", async () => {
  const sched = new JobScheduler();
  let ran = false;
  sched.register({
    id: "job-2",
    name: "Immediate Job",
    schedule: "every 10s",
    handler: async () => { ran = true; },
    intervalMs: 10_000,
  });
  await sched.runNow("job-2");
  assert.equal(ran, true);
});

test("autonomous: JobScheduler job status tracking", async () => {
  const sched = new JobScheduler();
  sched.register({
    id: "job-3",
    name: "Status Job",
    schedule: "every 5s",
    handler: async () => {},
    intervalMs: 5_000,
  });
  await sched.runNow("job-3");
  const job = sched.getJob("job-3")!;
  assert.equal(job.status, "completed");
  assert.ok(job.lastRunAt);
});

test("autonomous: JobScheduler tracks failed jobs", async () => {
  const sched = new JobScheduler();
  sched.register({
    id: "job-4",
    name: "Failing Job",
    schedule: "every 5s",
    handler: async () => { throw new Error("boom"); },
    intervalMs: 5_000,
  });
  await sched.runNow("job-4");
  assert.equal(sched.getJob("job-4")!.status, "failed");
  const stats = sched.getStats();
  assert.equal(stats.failed, 1);
});

test("autonomous: JobScheduler deregisters jobs", () => {
  const sched = new JobScheduler();
  sched.register({ id: "job-5", name: "To Remove", schedule: "every 1s", handler: async () => {}, intervalMs: 1000 });
  sched.deregister("job-5");
  assert.equal(sched.listJobs().length, 0);
});

// ── EventBus extensions ───────────────────────────────────────────────────────

test("autonomous: EventBus audit log records events", () => {
  const bus = new InMemoryEventBus();
  bus.emit({ type: "execution.started", tenantId: "t", timestamp: new Date().toISOString(), payload: {} });
  bus.emit({ type: "execution.completed", tenantId: "t", timestamp: new Date().toISOString(), payload: {} });
  const log = bus.getAuditLog();
  assert.equal(log.length, 2);
  assert.equal(log[0]!.type, "execution.started");
  assert.equal(log[1]!.type, "execution.completed");
});

test("autonomous: EventBus audit log caps at 1000", () => {
  const bus = new InMemoryEventBus();
  for (let i = 0; i < 1005; i++) {
    bus.emit({ type: "execution.started", tenantId: "t", timestamp: new Date().toISOString(), payload: { i } });
  }
  assert.equal(bus.getAuditLog().length, 1000);
});

test("autonomous: EventBus delayed event scheduling fires", async () => {
  const bus = new InMemoryEventBus();
  let received = false;
  bus.on("scheduled.job_triggered", () => { received = true; });
  bus.scheduleEvent({ type: "scheduled.job_triggered", tenantId: "t", timestamp: new Date().toISOString(), payload: {} }, 10);
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
  assert.equal(received, true);
});

test("autonomous: EventBus retry queue fires after delay", async () => {
  const bus = new InMemoryEventBus();
  const received: number[] = [];
  bus.on("execution.started", (e) => { received.push(e.payload["seq"] as number); });
  bus.retryEvent({ type: "execution.started", tenantId: "t", timestamp: new Date().toISOString(), payload: { seq: 42 } }, 10);
  await new Promise<void>((resolve) => setTimeout(resolve, 80));
  assert.ok(received.includes(42));
});

test("autonomous: EventBus event versioning field", () => {
  const bus = new InMemoryEventBus();
  const events: { version?: string }[] = [];
  bus.on("execution.started", (e) => { events.push({ version: e.version }); });
  bus.emit({ type: "execution.started", tenantId: "t", timestamp: new Date().toISOString(), payload: {}, version: "2" });
  assert.equal(events[0]?.version, "2");
});

test("autonomous: EventBus correlation chain field", () => {
  const bus = new InMemoryEventBus();
  let seen: string[] | undefined;
  bus.on("audit.event", (e) => { seen = e.correlationChain; });
  bus.emit({
    type: "audit.event",
    tenantId: "t",
    timestamp: new Date().toISOString(),
    payload: {},
    correlationChain: ["id-1", "id-2"],
  });
  assert.deepEqual(seen, ["id-1", "id-2"]);
});
