import Link from 'next/link';

const resources = [
  ['Domains', 'Manage registered domains, routes, DNS providers, and verification.'],
  ['Tenants', 'Create isolated customer environments with explicit residency and isolation policies.'],
  ['Nodes', 'Register GCP, private-cloud, bare-metal, and edge compute.'],
  ['Applications', 'Build deployable applications against a tenant and runtime.'],
  ['Deployments', 'Move workloads across cloud, private infrastructure, and edge nodes.'],
];

export default function HoareControlPlanePage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-10">
        <p className="text-sm font-medium uppercase tracking-widest opacity-60">Tech Fusion AI/ML</p>
        <h1 className="mt-2 text-4xl font-bold">HOARE Control Plane</h1>
        <p className="mt-3 max-w-3xl text-lg opacity-75">
          Provider-agnostic infrastructure control for domains, tenants, applications, deployments, and private cloud nodes.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {resources.map(([title, description]) => (
          <article key={title} className="rounded-2xl border p-6 shadow-sm">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm opacity-70">{description}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border p-6">
        <h2 className="text-xl font-semibold">Current platform identity</h2>
        <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          <div><span className="opacity-60">Corporate:</span> techfusional.com</div>
          <div><span className="opacity-60">Console:</span> hoare.techfusional.com</div>
          <div><span className="opacity-60">API:</span> api.techfusional.com</div>
          <div><span className="opacity-60">Private node:</span> HOARE-NODE-001</div>
        </div>
      </section>

      <div className="mt-8">
        <Link href="/" className="text-sm underline">Back to platform</Link>
      </div>
    </main>
  );
}
