export type IncidentTimelineEntry = {
  incidentId: string;
  stage: "detected" | "created" | "diagnosed" | "remediated" | "verified" | "resolved";
  message: string;
  timestamp: string;
};

export class IncidentTimeline {
  private readonly entries: IncidentTimelineEntry[] = [];

  push(entry: IncidentTimelineEntry): void {
    this.entries.push(entry);
  }

  list(incidentId: string): IncidentTimelineEntry[] {
    return this.entries.filter((entry) => entry.incidentId === incidentId);
  }
}
