'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Decision = 'ALLOW' | 'DENY' | 'ESCALATE' | string;

type PermissionSet = {
  contents_read?: boolean;
  metadata_read?: boolean;
  pull_requests_read?: boolean;
  issues_read?: boolean;
  branches_write?: boolean;
  contents_write?: boolean;
  pull_requests_write?: boolean;
  merge?: boolean;
  deploy?: boolean;
  secrets_read?: boolean;
  secrets_write?: boolean;
};

type AuditEvent = {
  event_id?: string;
  tenant_id?: string;
  repository?: string;
  action?: string;
  decision?: Decision;
  actor?: string;
  timestamp?: string;
  reason?: string;
  [key: string]: unknown;
};

type RepositoryInfo = {
  full_name?: string;
  name?: string;
  owner?: { login?: string };
  default_branch?: string;
  private?: boolean;
  html_url?: string;
  description?: string | null;
  [key: string]: unknown;
};

type ApiError = { error?: string; detail?: string };

const permissions: Array<[keyof PermissionSet, string, string]> = [
  ['contents_read', 'Contents read', 'Inspect source and repository files.'],
  ['metadata_read', 'Metadata read', 'Read repository identity and metadata.'],
  ['pull_requests_read', 'Pull requests read', 'Inspect existing pull requests.'],
  ['issues_read', 'Issues read', 'Inspect issue context when explicitly granted.'],
  ['branches_write', 'Branches write', 'Create governed working branches.'],
  ['contents_write', 'Contents write', 'Write governed repository changes.'],
  ['pull_requests_write', 'Pull requests write', 'Create pull requests from governed changes.'],
  ['merge', 'Merge', 'Restricted; AEGIS normally escalates.'],
  ['deploy', 'Deploy', 'Restricted; AEGIS normally escalates.'],
];

const initialPermissions: PermissionSet = {
  contents_read: true,
  metadata_read: true,
  pull_requests_read: true,
  issues_read: false,
  branches_write: false,
  contents_write: false,
  pull_requests_write: false,
  merge: false,
  deploy: false,
  secrets_read: false,
  secrets_write: false,
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/hoare/github/${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const raw = await response.text();
  let data: unknown = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    const message = (data as ApiError).error || (data as ApiError).detail || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

function decisionClass(decision?: Decision) {
  if (decision === 'ALLOW') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700';
  if (decision === 'ESCALATE') return 'border-amber-500/40 bg-amber-500/10 text-amber-700';
  if (decision === 'DENY') return 'border-red-500/40 bg-red-500/10 text-red-700';
  return 'border-slate-500/30 bg-slate-500/10';
}

export default function HoareGitHubGovernancePage() {
  const [installationId, setInstallationId] = useState('');
  const [repositoryInput, setRepositoryInput] = useState('');
  const [repositories, setRepositories] = useState<string[]>([]);
  const [permissionSet, setPermissionSet] = useState<PermissionSet>(initialPermissions);
  const [repository, setRepository] = useState<RepositoryInfo | null>(null);
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [decision, setDecision] = useState<unknown>(null);
  const [branchName, setBranchName] = useState('hoare/governed-change');
  const [baseSha, setBaseSha] = useState('');
  const [prTitle, setPrTitle] = useState('HOARE governed change');
  const [headBranch, setHeadBranch] = useState('');
  const [baseBranch, setBaseBranch] = useState('main');
  const [prBody, setPrBody] = useState('Created through the HOARE GitHub governance boundary.');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedRepository = useMemo(() => {
    const first = repositories[0];
    return first || repositoryInput.trim();
  }, [repositories, repositoryInput]);

  const refresh = useCallback(async () => {
    setBusy('refresh');
    setError(null);
    try {
      const [scope, events] = await Promise.all([
        api<{ repositories?: string[] }>('repositories'),
        api<{ events?: AuditEvent[] }>('audit?limit=50'),
      ]);
      setRepositories(scope.repositories || []);
      setAudit(events.events || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load GitHub governance state.');
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    const repos = repositoryInput
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!installationId.trim() || repos.length === 0) {
      setError('Installation ID and at least one repository are required.');
      return;
    }

    setBusy('connect');
    setError(null);
    setMessage(null);
    try {
      await api('install', {
        method: 'POST',
        body: JSON.stringify({
          installation_id: installationId.trim(),
          repositories: repos,
          permissions: permissionSet,
        }),
      });
      setMessage('GitHub scope installed through the HOARE authentication and AEGIS boundary.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'GitHub installation failed.');
    } finally {
      setBusy(null);
    }
  }

  async function inspect() {
    if (!selectedRepository) return setError('Select or enter a repository first.');
    setBusy('inspect');
    setError(null);
    try {
      const result = await api<RepositoryInfo>(
        `repositories/${encodeURIComponent(selectedRepository.split('/')[0])}/${encodeURIComponent(selectedRepository.split('/')[1] || '')}`,
      );
      setRepository(result);
      setMessage('Repository metadata loaded through the governed broker.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Repository inspection failed.');
    } finally {
      setBusy(null);
    }
  }

  async function analyze() {
    if (!selectedRepository) return setError('Select or enter a repository first.');
    setBusy('analyze');
    setError(null);
    try {
      const result = await api('analyze', {
        method: 'POST',
        body: JSON.stringify({ repository: selectedRepository, path: 'README.md' }),
      });
      setAnalysis(result);
      setMessage('Repository evidence loaded. No client-side authorization decision was made.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Repository analysis failed.');
    } finally {
      setBusy(null);
    }
  }

  async function evaluate(action: string) {
    if (!selectedRepository) return setError('Select or enter a repository first.');
    setBusy(`decision:${action}`);
    setError(null);
    try {
      const result = await api('action', {
        method: 'POST',
        body: JSON.stringify({ action, repository: selectedRepository, branch: headBranch || undefined }),
      });
      setDecision(result);
      setMessage(`AEGIS evaluated ${action}; the UI did not grant authority locally.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'AEGIS evaluation failed.');
    } finally {
      setBusy(null);
    }
  }

  async function createBranch(event: FormEvent) {
    event.preventDefault();
    if (!selectedRepository || !baseSha.trim() || !branchName.trim()) {
      setError('Repository, branch name, and base commit SHA are required.');
      return;
    }
    setBusy('branch');
    setError(null);
    try {
      await api('branch', {
        method: 'POST',
        body: JSON.stringify({
          repository: selectedRepository,
          branch: branchName.trim(),
          base_sha: baseSha.trim(),
        }),
      });
      setHeadBranch(branchName.trim());
      setMessage(`Branch ${branchName.trim()} created through the governed write boundary.`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Branch creation failed.');
    } finally {
      setBusy(null);
    }
  }

  async function createPullRequest(event: FormEvent) {
    event.preventDefault();
    if (!selectedRepository || !prTitle.trim() || !headBranch.trim() || !baseBranch.trim()) {
      setError('Repository, PR title, head branch, and base branch are required.');
      return;
    }
    setBusy('pull-request');
    setError(null);
    try {
      const result = await api('pull-request', {
        method: 'POST',
        body: JSON.stringify({
          repository: selectedRepository,
          title: prTitle.trim(),
          head: headBranch.trim(),
          base: baseBranch.trim(),
          body: prBody,
        }),
      });
      setMessage('Pull request created through HOARE → AEGIS → GitHub.');
      setAnalysis(result);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pull request creation failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-6 md:p-8">
      <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest opacity-60">HOARE Control Plane</p>
          <h1 className="mt-2 text-4xl font-bold">GitHub Governance</h1>
          <p className="mt-3 max-w-3xl text-base opacity-75">
            Governed repository access for inspection, analysis, branch creation, and pull requests. AEGIS remains the authority boundary; this page is only the control surface.
          </p>
        </div>
        <Link href="/platform/hoare" className="text-sm underline">Back to HOARE</Link>
      </header>

      {(message || error) && (
        <div className={`mb-6 rounded-xl border p-4 text-sm ${error ? 'border-red-500/40 bg-red-500/10 text-red-700' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="rounded-2xl border p-6 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-semibold">1. Connect repository scope</h2>
          <p className="mt-2 text-sm opacity-70">
            No GitHub token is collected by this browser UI. The HOARE backend owns the installation credential and applies tenant/API-key authentication.
          </p>
          <form onSubmit={connect} className="mt-5 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">GitHub App installation ID</span>
              <input className="w-full rounded-lg border bg-transparent px-3 py-2" value={installationId} onChange={(event) => setInstallationId(event.target.value)} placeholder="12345678" />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Repositories</span>
              <textarea className="min-h-20 w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-sm" value={repositoryInput} onChange={(event) => setRepositoryInput(event.target.value)} placeholder="FARICJH59/example-repo" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {permissions.map(([key, title, description]) => (
                <label key={key} className="flex gap-3 rounded-xl border p-3 text-sm">
                  <input type="checkbox" checked={Boolean(permissionSet[key])} disabled={key === 'secrets_read' || key === 'secrets_write'} onChange={(event) => setPermissionSet((current) => ({ ...current, [key]: event.target.checked }))} />
                  <span><strong>{title}</strong><span className="mt-1 block opacity-60">{description}</span></span>
                </label>
              ))}
            </div>
            <button disabled={busy !== null} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">
              {busy === 'connect' ? 'Connecting…' : 'Install governed scope'}
            </button>
          </form>
        </article>

        <article className="rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold">AEGIS decision</h2>
          <p className="mt-2 text-sm opacity-70">Decision state comes from HOARE. The browser cannot override it.</p>
          <div className="mt-5 grid gap-2">
            {['contents_read', 'branches_write', 'pull_requests_write', 'merge', 'deploy'].map((action) => (
              <button key={action} onClick={() => void evaluate(action)} disabled={busy !== null || !selectedRepository} className="rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50">
                Evaluate <strong>{action}</strong>
              </button>
            ))}
          </div>
          {decision && (
            <pre className={`mt-4 overflow-auto rounded-xl border p-4 text-xs ${decisionClass((decision as { decision?: Decision }).decision)}`}>
              {JSON.stringify(decision, null, 2)}
            </pre>
          )}
        </article>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold">2. Repository inspection</h2>
          <div className="mt-4 flex gap-2">
            <input className="min-w-0 flex-1 rounded-lg border bg-transparent px-3 py-2 font-mono text-sm" value={repositoryInput} onChange={(event) => setRepositoryInput(event.target.value)} placeholder="owner/repository" />
            <button onClick={() => void inspect()} disabled={busy !== null || !selectedRepository} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Inspect</button>
            <button onClick={() => void analyze()} disabled={busy !== null || !selectedRepository} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Analyze</button>
          </div>
          {repositories.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {repositories.map((repo) => <button key={repo} onClick={() => setRepositoryInput(repo)} className="rounded-full border px-3 py-1 text-xs">{repo}</button>)}
            </div>
          )}
          {repository && (
            <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-black p-4 text-xs text-white">{JSON.stringify(repository, null, 2)}</pre>
          )}
          {analysis && (
            <pre className="mt-4 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(analysis, null, 2)}</pre>
          )}
        </article>

        <article className="rounded-2xl border p-6 shadow-sm">
          <h2 className="text-xl font-semibold">3. Governed branch + PR</h2>
          <form onSubmit={createBranch} className="space-y-3">
            <input className="w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-sm" value={branchName} onChange={(event) => setBranchName(event.target.value)} placeholder="hoare/governed-change" />
            <input className="w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-sm" value={baseSha} onChange={(event) => setBaseSha(event.target.value)} placeholder="Base commit SHA" />
            <button disabled={busy !== null} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy === 'branch' ? 'Creating…' : 'Create governed branch'}</button>
          </form>
          <form onSubmit={createPullRequest} className="mt-6 space-y-3 border-t pt-6">
            <input className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm" value={prTitle} onChange={(event) => setPrTitle(event.target.value)} placeholder="Pull request title" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-sm" value={headBranch} onChange={(event) => setHeadBranch(event.target.value)} placeholder="Head branch" />
              <input className="w-full rounded-lg border bg-transparent px-3 py-2 font-mono text-sm" value={baseBranch} onChange={(event) => setBaseBranch(event.target.value)} placeholder="Base branch" />
            </div>
            <textarea className="min-h-24 w-full rounded-lg border bg-transparent px-3 py-2 text-sm" value={prBody} onChange={(event) => setPrBody(event.target.value)} />
            <button disabled={busy !== null} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">{busy === 'pull-request' ? 'Creating…' : 'Create governed PR'}</button>
          </form>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Governance audit evidence</h2>
            <p className="mt-1 text-sm opacity-70">Tenant-scoped events returned by the HOARE GitHub broker.</p>
          </div>
          <button onClick={() => void refresh()} disabled={busy !== null} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy === 'refresh' ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wider opacity-60"><tr><th className="py-2 pr-4">Time</th><th className="py-2 pr-4">Repository</th><th className="py-2 pr-4">Action</th><th className="py-2 pr-4">Decision</th><th className="py-2">Reason</th></tr></thead>
            <tbody>
              {audit.map((event, index) => (
                <tr key={event.event_id || index} className="border-b last:border-0">
                  <td className="py-2 pr-4 whitespace-nowrap">{event.timestamp || '—'}</td>
                  <td className="py-2 pr-4 font-mono">{event.repository || '—'}</td>
                  <td className="py-2 pr-4">{event.action || '—'}</td>
                  <td className="py-2 pr-4"><span className={`rounded-full border px-2 py-1 text-xs ${decisionClass(event.decision)}`}>{event.decision || '—'}</span></td>
                  <td className="py-2">{event.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {audit.length === 0 && <p className="py-6 text-sm opacity-60">No GitHub governance events returned for the current tenant.</p>}
        </div>
      </section>
    </main>
  );
}
