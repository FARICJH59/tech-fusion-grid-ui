/**
 * JobScheduler — interval-based background job execution with status tracking.
 */

import { randomUUID } from "node:crypto";
import { eventBus } from "@/lib/runtime/event-bus";
import { onShutdown } from "@/lib/utils/shutdown";
import type { JobStatus, ScheduledJob } from "./types";

type ScheduledJobInternal = ScheduledJob & {
  intervalMs: number;
  timer?: ReturnType<typeof setInterval>;
};

const DEFAULT_CONCURRENCY_LIMIT = 10;

export class JobScheduler {
  private readonly jobs = new Map<string, ScheduledJobInternal>();
  private running = false;
  private activeCount = 0;
  private readonly concurrencyLimit: number;

  constructor(concurrencyLimit = DEFAULT_CONCURRENCY_LIMIT) {
    this.concurrencyLimit = concurrencyLimit;
  }

  register(
    job: Omit<ScheduledJob, "status" | "lastRunAt" | "nextRunAt"> & { intervalMs: number },
  ): void {
    const internal: ScheduledJobInternal = {
      ...job,
      status: "pending",
      nextRunAt: new Date(Date.now() + job.intervalMs).toISOString(),
    };
    this.jobs.set(job.id, internal);
    if (this.running) this.scheduleJob(internal);
  }

  deregister(id: string): void {
    const job = this.jobs.get(id);
    if (job?.timer) clearInterval(job.timer);
    this.jobs.delete(id);
  }

  async runNow(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Job ${id} not found`);
    await this.executeJob(job);
  }

  getJob(id: string): ScheduledJob | undefined {
    const j = this.jobs.get(id);
    if (!j) return undefined;
    // Return without internal fields
    const { timer: _timer, intervalMs: _intervalMs, ...rest } = j;
    return rest;
  }

  listJobs(): ScheduledJob[] {
    return [...this.jobs.values()].map(({ timer: _timer, intervalMs: _intervalMs, ...rest }) => rest);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    for (const job of this.jobs.values()) {
      this.scheduleJob(job);
    }
  }

  stop(): void {
    this.running = false;
    for (const job of this.jobs.values()) {
      if (job.timer) {
        clearInterval(job.timer);
        job.timer = undefined;
      }
    }
  }

  getStats(): { total: number; running: number; completed: number; failed: number } {
    let running = 0, completed = 0, failed = 0;
    for (const job of this.jobs.values()) {
      if (job.status === "running") running++;
      else if (job.status === "completed") completed++;
      else if (job.status === "failed") failed++;
    }
    return { total: this.jobs.size, running, completed, failed };
  }

  private scheduleJob(job: ScheduledJobInternal): void {
    if (job.timer) clearInterval(job.timer);
    job.timer = setInterval(() => {
      void this.executeJob(job);
    }, job.intervalMs);
    if (typeof job.timer === "object" && "unref" in job.timer) {
      (job.timer as ReturnType<typeof setInterval> & { unref: () => void }).unref();
    }
  }

  private async executeJob(job: ScheduledJobInternal): Promise<void> {
    if (this.activeCount >= this.concurrencyLimit) return;

    this.activeCount++;
    job.status = "running";
    const now = new Date().toISOString();
    job.lastRunAt = now;
    job.nextRunAt = new Date(Date.now() + job.intervalMs).toISOString();

    eventBus.emit({
      type: "scheduled.job_triggered",
      tenantId: job.tenantId ?? "system",
      timestamp: now,
      payload: { jobId: job.id, name: job.name },
      version: "1",
    });

    try {
      await job.handler();
      job.status = "completed";
      eventBus.emit({
        type: "scheduled.job_completed",
        tenantId: job.tenantId ?? "system",
        timestamp: new Date().toISOString(),
        payload: { jobId: job.id, name: job.name, success: true },
        version: "1",
      });
    } catch {
      job.status = "failed";
    } finally {
      this.activeCount--;
    }
  }
}

export const jobScheduler = new JobScheduler();

onShutdown("job-scheduler", async () => {
  jobScheduler.stop();
});
