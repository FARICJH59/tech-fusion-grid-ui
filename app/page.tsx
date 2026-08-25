import Link from 'next/link';

const products = [
  ['HOARE', 'Verifiable agent execution and control plane for identity, admission, policy, capabilities, execution and attestation.'],
  ['PASOR', 'Project-aware planning and optimization for workload sequencing, quota usage, compute efficiency and future energy-aware scheduling.'],
  ['AEGIS', 'Constrained execution and verification layer for agentic systems that need explicit contracts and controlled behavior.'],
  ['Tech Fusion Grid', 'Operational interface for telemetry, infrastructure, cloud runtime, edge systems and enterprise workloads.'],
  ['Perception Systems', 'Multimodal perception-to-action foundations for retail, robotics, drones, industrial and scientific applications.'],
  ['Energy / VPP', 'Planned vertical for coordinating distributed energy resources and energy-aware compute workloads under explicit safety and policy constraints.'],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="font-semibold tracking-wide">TECH FUSION AI/ML LLC</Link>
          <div className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <a href="#about" className="hover:text-white">About</a>
            <a href="#products" className="hover:text-white">Products</a>
            <a href="#ip" className="hover:text-white">IP Disclosure</a>
            <a href="#contact" className="hover:text-white">Contact</a>
          </div>
          <div className="flex gap-2">
            <Link href="/auth/login" className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800">Sign in</Link>
            <Link href="/workspace" className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Start Workspace</Link>
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-24 pt-20 lg:px-8 lg:pt-28">
        <div className="max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">Autonomous intelligence infrastructure</p>
          <h1 className="mt-5 text-5xl font-bold tracking-tight md:text-7xl">From perception to verified action.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-400">
            Tech Fusion AI/ML builds an agentic infrastructure stack that connects perception, memory, reasoning, optimization and action with explicit identity, policy, execution and verification boundaries.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/workspace" className="rounded-xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 hover:bg-cyan-400">Enter the platform</Link>
            <a href="#products" className="rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-200 hover:bg-slate-900">Explore the stack</a>
          </div>
        </div>
      </section>

      <section id="about" className="border-y border-slate-800 bg-slate-900/40">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">About</p>
            <h2 className="mt-3 text-3xl font-semibold">A common control architecture for many verticals.</h2>
          </div>
          <p className="text-slate-400 leading-7">
            The platform is designed so the same control and verification foundations can support software engineering, real-time perception, robotics, industrial systems, scientific workloads and energy infrastructure. PASOR can optimize work before execution; HOARE governs what is admitted and executed; AEGIS supplies constrained execution logic; the Grid interface exposes operational state.
          </p>
        </div>
      </section>

      <section id="products" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Products & platforms</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map(([name, description]) => (
            <article key={name} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h3 className="text-xl font-semibold">{name}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="ip" className="border-y border-slate-800 bg-slate-900/40">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">IP disclosure</p>
          <h2 className="mt-3 text-3xl font-semibold">Architecture and software IP</h2>
          <p className="mt-5 max-w-4xl text-sm leading-7 text-slate-400">
            Tech Fusion AI/ML LLC is developing proprietary software, orchestration methods, execution controls, optimization techniques, interfaces and system architectures. Public descriptions are intentionally high-level and do not disclose confidential implementation details, credentials, private datasets, security controls or unpublished inventions. Nothing on this page should be interpreted as a complete legal patent or trade-secret disclosure.
          </p>
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="rounded-2xl border border-cyan-900/60 bg-cyan-950/20 p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">Client onboarding</p>
          <h2 className="mt-3 text-3xl font-semibold">Start with a use case.</h2>
          <p className="mt-3 max-w-2xl text-slate-400">Clients can move from the public website into the authenticated workspace, where the HOARE prompt panel becomes the entry point for project planning and future autonomous execution.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/auth/signup" className="rounded-lg bg-cyan-500 px-5 py-3 font-semibold text-slate-950">Create account</Link>
            <Link href="/workspace" className="rounded-lg border border-slate-700 px-5 py-3 font-semibold">Open workspace</Link>
          </div>
          <p className="mt-6 text-sm text-slate-500">Virginia, USA · 571-602-2102</p>
        </div>
      </section>

      <footer className="border-t border-slate-800 px-5 py-8 text-center text-xs text-slate-600">
        Tech Fusion AI/ML LLC · Autonomous intelligence infrastructure
      </footer>
    </main>
  );
}
