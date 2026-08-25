'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

const navigation = [
  ['Workspace', '/workspace'],
  ['HOARE Control', '/platform/hoare'],
  ['Execution', '/execution-plane'],
  ['Telemetry', '/telemetry'],
  ['Operations', '/operations'],
  ['Audit', '/audit'],
];

const capabilities = [
  ['PASOR', 'Project planning, quota-aware execution, energy-aware optimization'],
  ['HOARE', 'Admission, capabilities, policy, execution and verification'],
  ['AEGIS', 'Constrained execution contracts and plan integrity'],
  ['Grid', 'Telemetry, infrastructure, cloud runtime and operational control'],
  ['Perception', 'Real-world sensing and application-specific agents'],
];

export default function WorkspaceClient() {
  const [prompt, setPrompt] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="border-r border-slate-800 bg-slate-950 p-5">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">Tech Fusion AI/ML</p>
            <h1 className="mt-2 text-xl font-bold">HOARE Workspace</h1>
            <p className="mt-2 text-xs text-slate-500">Client project command center</p>
          </div>

          <nav className="space-y-1">
            {navigation.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="block rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-10 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">Execution boundary</p>
            <p className="mt-2 text-sm text-emerald-400">HOARE connected</p>
            <p className="mt-1 text-xs text-slate-500">Admission → policy → execution → verification</p>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="border-b border-slate-800 px-5 py-4 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Platform Workspace</p>
                <h2 className="mt-1 text-2xl font-semibold">What do you want Tech Fusion to build?</h2>
              </div>
              <Link href="/" className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
                Website
              </Link>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-6 p-5 lg:p-8">
            <form onSubmit={submitPrompt} className="rounded-2xl border border-cyan-900/60 bg-slate-900 p-5 shadow-2xl shadow-cyan-950/20">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-cyan-300">HOARE Prompt Panel</p>
                  <p className="mt-1 text-xs text-slate-500">Describe a project or client use case. Planning comes before execution.</p>
                </div>
                <span className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-400">PASOR preflight</span>
              </div>

              <textarea
                value={prompt}
                onChange={(event) => { setPrompt(event.target.value); setSubmitted(false); }}
                rows={7}
                placeholder="Example: Build a real-time shelf perception system that detects inventory changes, creates a golden evaluation set, minimizes redundant compute, and deploys the verified workload to an edge node."
                className="w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-500"
              />

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="submit" className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
                  Prepare with HOARE
                </button>
                <span className="text-xs text-slate-500">No workload is executed by this button yet; it prepares the client request for the orchestration boundary.</span>
              </div>

              {submitted && (
                <div className="mt-4 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-sm">
                  <p className="font-medium text-emerald-300">Request captured for orchestration.</p>
                  <p className="mt-1 text-xs text-slate-400">Next integration stage: project inventory → PASOR plan → HOARE receipt → admitted execution.</p>
                </div>
              )}
            </form>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {capabilities.map(([title, description]) => (
                <article key={title} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <article className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
                <p className="text-xs uppercase tracking-wider text-slate-500">Lifecycle</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                  {['Prompt', 'Inventory', 'PASOR', 'AEGIS', 'HOARE', 'Execution', 'Verification'].map((step, index) => (
                    <span key={step} className="flex items-center gap-2">
                      <span className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2">{step}</span>
                      {index < 6 && <span className="text-slate-600">→</span>}
                    </span>
                  ))}
                </div>
              </article>

              <article className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                <p className="text-xs uppercase tracking-wider text-slate-500">Optimization target</p>
                <p className="mt-3 text-2xl font-semibold">Compute + Energy</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">PASOR can use project inventory, quota and energy-cost metadata before workloads cross the HOARE execution boundary.</p>
              </article>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
