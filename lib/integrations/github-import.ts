import { createHash } from "node:crypto";

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  default_branch?: string | null;
  private?: boolean;
  html_url?: string;
};

export type GitHubImportResult = {
  repository: GitHubRepository;
  source_sha: string;
};

function githubToken(): string {
  const token = process.env.GITHUB_IMPORT_TOKEN;
  if (!token) {
    throw new Error("GITHUB_IMPORT_TOKEN is not configured");
  }
  return token;
}

function repositoryPath(input: string): string {
  const value = input.trim().replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
  const parts = value.split("/").filter(Boolean);
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part))) {
    throw new Error("GitHub repository must be owner/name or a github.com/owner/name URL");
  }
  return `${parts[0]}/${parts[1]}`;
}

async function githubRequest<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken()}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "HOARE-Project-Importer",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export async function importGitHubRepository(repository: string): Promise<GitHubImportResult> {
  const path = repositoryPath(repository);
  const repo = await githubRequest<GitHubRepository>(`repos/${path}`);
  const branch = repo.default_branch ?? "main";
  const ref = await githubRequest<{ object?: { sha?: string } }>(`repos/${path}/git/ref/heads/${encodeURIComponent(branch)}`);
  const sha = ref.object?.sha;
  if (!sha) throw new Error("GitHub repository default branch SHA was not returned");

  return {
    repository: repo,
    source_sha: createHash("sha256").update(`${repo.id}:${sha}`).digest("hex"),
  };
}
