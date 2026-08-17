import { createHash } from "node:crypto";
import type { KnowledgeCandidate } from "./knowledge";

export interface KnowledgeVersion {
  version: number;
  record_id: string;
  candidate: KnowledgeCandidate;
  created_at: string;
  version_hash: string;
}

export interface KnowledgeRecord {
  record_id: string;
  tenant_id: string;
  project_id: string;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeRepository {
  save(candidate: KnowledgeCandidate): Promise<KnowledgeVersion>;
  get(recordId: string, tenantId: string, projectId: string): Promise<KnowledgeVersion | null>;
  history(recordId: string, tenantId: string, projectId: string): Promise<KnowledgeVersion[]>;
}

export function knowledgeRecordId(candidate: KnowledgeCandidate): string {
  return createHash("sha256")
    .update(`${candidate.tenant_id}:${candidate.project_id}:${candidate.id}`)
    .digest("hex");
}

export function knowledgeVersionHash(candidate: KnowledgeCandidate, version: number): string {
  return createHash("sha256")
    .update(JSON.stringify({ candidate, version }))
    .digest("hex");
}

export class FileKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly rootDir: string) {}

  private recordDir(recordId: string, tenantId: string, projectId: string): string {
    const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${this.rootDir}/${safe(tenantId)}/${safe(projectId)}/${safe(recordId)}`;
  }

  async save(candidate: KnowledgeCandidate): Promise<KnowledgeVersion> {
    const fs = await import("node:fs/promises");
    const recordId = knowledgeRecordId(candidate);
    const dir = this.recordDir(recordId, candidate.tenant_id, candidate.project_id);
    await fs.mkdir(dir, { recursive: true });

    let version = 1;
    try {
      const current = JSON.parse(await fs.readFile(`${dir}/current.json`, "utf8")) as KnowledgeVersion;
      version = current.version + 1;
    } catch {
      // First version.
    }

    const now = new Date().toISOString();
    const record: KnowledgeVersion = {
      version,
      record_id: recordId,
      candidate: structuredClone(candidate),
      created_at: now,
      version_hash: knowledgeVersionHash(candidate, version),
    };

    const versionPath = `${dir}/v${version}.json`;
    const tempPath = `${versionPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(record, null, 2), { encoding: "utf8", flag: "wx" });
    await fs.rename(tempPath, versionPath);

    const currentTemp = `${dir}/current.json.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(currentTemp, JSON.stringify(record, null, 2), { encoding: "utf8", flag: "wx" });
    await fs.rename(currentTemp, `${dir}/current.json`);
    return record;
  }

  async get(recordId: string, tenantId: string, projectId: string): Promise<KnowledgeVersion | null> {
    const fs = await import("node:fs/promises");
    try {
      return JSON.parse(await fs.readFile(`${this.recordDir(recordId, tenantId, projectId)}/current.json`, "utf8")) as KnowledgeVersion;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async history(recordId: string, tenantId: string, projectId: string): Promise<KnowledgeVersion[]> {
    const fs = await import("node:fs/promises");
    const dir = this.recordDir(recordId, tenantId, projectId);
    try {
      const names = (await fs.readdir(dir)).filter((name) => /^v\d+\.json$/.test(name)).sort((a, b) => Number(a.slice(1, -5)) - Number(b.slice(1, -5)));
      return Promise.all(names.map(async (name) => JSON.parse(await fs.readFile(`${dir}/${name}`, "utf8")) as KnowledgeVersion));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
}
