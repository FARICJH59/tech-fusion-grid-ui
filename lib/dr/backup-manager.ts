export type BackupRecord = {
  tenantId: string;
  region: string;
  resource: string;
  timestamp: string;
  status: "success" | "failed";
};

export class BackupManager {
  private readonly records: BackupRecord[] = [];

  run(tenantId: string, region: string, resource: string): BackupRecord {
    const record: BackupRecord = {
      tenantId,
      region,
      resource,
      timestamp: new Date().toISOString(),
      status: "success",
    };
    this.records.push(record);
    return record;
  }

  list(tenantId: string): BackupRecord[] {
    return this.records.filter((record) => record.tenantId === tenantId);
  }
}

export const backupManager = new BackupManager();
