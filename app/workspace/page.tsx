"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const modules = [
  { name: "HOARE", detail: "Prompt → plan → governed execution", href: "/platform/hoare" },
  { name: "PASOR", detail: "Quota-aware planning, simulation, and execution optimization", href: "/platform/hoare" },
  { name: "AEGISC", detail: "Verified security and execution policy layer", href: "/platform/hoare" },
  { name: "Perception", detail: "Vision, audio, telemetry, spatial and sensor inputs", href: "/operations" },
  { name: "Execution", detail: "Controlled workloads with integrity and isolation", href: "/execution-plane" },
  { name: "Energy", detail: "Optimization foundation for grid and virtual power plant workloads", href: "/operations" },
];

export default function WorkspacePage() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("Ready");
  const [plan, setPlan] = useState<string[]>([]);

  async function submitPrompt(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;

    setStatus("Planning with HOARE…");
    setPlan([]);

    try {
      const response = await fetch("/api/hoare/builder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenantId: "workspace-demo",
          name: "Client use case",
          description: prompt.trim(),
          resources: ["runtime", "telemetry", "policy", "execution"],
          environment: "development",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create plan");

      const steps = Array.isArray(data.steps)
        ? data.steps.map((step: unknown) => String(step))
        : ["Intent accepted", "Builder plan generated", "Execution remains policy-gated"];
      setPlan(steps);
      setStatus("Plan ready");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Planning failed");
    }
  }

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <header className="border-b border-white/10 bg-[#0b1728]/95 px-6 py-4 backdrop-blur md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">Tech Fusion AI/ML</div>
            <div className="mt-1 text-xl font-bold">Native Intelligence Workspace</div>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5" href="/">Website / Console</Link>
            <span className="rounded-lg bg-cyan-400/10 px-3 py-2 text-cyan-200">Workspace</span>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1.35fr_.65fr] md:px-10">
        <div>
          <div className="mb-6">
            <p className="text-sm text-slate-400">Client command center</p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">Describe the project. HOARE builds the execution plan.</h1>
            <p className="mt-4 max-w-3xl text-slate-300">The workspace is the application layer. HOARE is the governed execution/control layer underneath it; PASOR optimizes the plan against quota, cost, runtime, and energy constraints.</p>
          </div>

          <form onSubmit={submitPrompt} className="rounded-2xl border border-cyan-300/20 bg-[#0d1b2e] p-5 shadow-2xl">
            <label className="text-sm font-medium text-slate-300" htmlFor="hoare-prompt">HOARE project prompt</label>
            <textarea
              id="hoare-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Example: Build a real-time perception system for a virtual power plant that predicts load, optimizes compute, and verifies every execution."
              className="mt-3 min-h-36 w-full resize-y rounded-xl border border-white/10 bg-[#07111f] p-4 text-sm text-white outline-none ring-cyan-300/30 placeholder:text-slate-500 focus:ring-2"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-400">Status: {status}</span>
              <button className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200" type="submit">Generate governed plan</button>
            </div>
          </form>

          <section className="mt-6 rounded-2xl border border-white/10 bg-[#0b1728] p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Execution plan</h2>
              <span className="text-xs text-slate-500">HOARE → PASOR → policy → execution</span>
            </div>
            {plan.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Your generated plan will appear here before any workload is dispatched.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {plan.map((step, index) => <li key={`${index}-${step}`} className="rounded-xl border border-white/10 bg-[#07111f] p-3 text-sm"><span className="mr-2 text-cyan-300">{index + 1}.</span>{step}</li>)}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#0b1728] p-5">
            <h2 className="font-semibold">Native control surface</h2>
            <p className="mt-2 text-sm text-slate-400">One interface for the existing grid, agent, runtime, and governance layers.</p>
          </div>
          {modules.map((module) => (
            <Link key={module.name} href={module.href} className="block rounded-2xl border border-white/10 bg-[#0b1728] p-5 transition hover:border-cyan-300/30 hover:bg-[#0e1d31]">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{module.name}</h3>
                <span className="text-cyan-300">→</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{module.detail}</p>
            </Link>
          ))}
        </aside>
      </section>
    </main>
  );
}
