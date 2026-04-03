import * as nodeSchedule from 'node-schedule';
import { db } from '../db/index.js';
import { schedules } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { Schedule, patternToCron } from './pattern-to-cron.js';
import { triggerRun } from './trigger-run.js';

class SchedulerService {
  private jobs = new Map<string, nodeSchedule.Job>();

  /** Load all enabled schedules from DB and register jobs. Called by leader pod on startup. */
  async initialize(): Promise<void> {
    const rows = await db.select().from(schedules).where(eq(schedules.enabled, 1));
    console.log(`[Scheduler] Initializing ${rows.length} enabled schedule(s)`);
    for (const row of rows) {
      const schedule = this._rowToSchedule(row);
      this.registerJob(schedule);
    }
  }

  /** Cancel all jobs — called when this pod loses leadership. */
  cancelAllJobs(): void {
    for (const [id, job] of this.jobs) {
      job.cancel();
      console.log(`[Scheduler] Cancelled job ${id}`);
    }
    this.jobs.clear();
  }

  registerJob(schedule: Schedule): void {
    // Cancel existing job for this id if any
    this.unregisterJob(schedule.id);

    const job = nodeSchedule.scheduleJob(schedule.cronExpression, async () => {
      await this._triggerRun(schedule);
    });

    if (job) {
      this.jobs.set(schedule.id, job);
      console.log(`[Scheduler] Registered job "${schedule.name}" (${schedule.cronExpression})`);
    } else {
      console.error(`[Scheduler] Failed to register job for schedule ${schedule.id} — invalid cron?`);
    }
  }

  unregisterJob(scheduleId: string): void {
    const existing = this.jobs.get(scheduleId);
    if (existing) {
      existing.cancel();
      this.jobs.delete(scheduleId);
    }
  }

  rescheduleJob(schedule: Schedule): void {
    this.registerJob(schedule);
  }

  hasJob(scheduleId: string): boolean {
    return this.jobs.has(scheduleId);
  }

  getNextRunTime(cronExpr: string): Date | null {
    const job = nodeSchedule.scheduleJob(cronExpr, () => {});
    if (!job) return null;
    const next = job.nextInvocation();
    job.cancel();
    return next ? new Date(next.toString()) : null;
  }

  private async _triggerRun(schedule: Schedule): Promise<void> {
    try {
      const result = await triggerRun({
        projectId: schedule.projectId,
        targetPaths: schedule.targetPaths,
        config: schedule.config,
        triggeredBy: `scheduler:${schedule.name}`,
      });

      const now = new Date();
      const nextRun = this.getNextRunTime(schedule.cronExpression);

      await db.update(schedules)
        .set({ lastRunAt: now, lastRunId: result.runId, nextRunAt: nextRun })
        .where(eq(schedules.id, schedule.id));

      console.log(`[Scheduler] Triggered run for "${schedule.name}" → runId: ${result.runId}`);
    } catch (err) {
      console.error(`[Scheduler] Error triggering run for "${schedule.name}":`, err);
    }
  }

  private _rowToSchedule(row: any): Schedule {
    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      targetPaths: JSON.parse(row.targetPaths || '[]'),
      config: JSON.parse(row.config),
      pattern: JSON.parse(row.pattern),
      cronExpression: row.cronExpression,
      enabled: row.enabled === 1,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      lastRunAt: row.lastRunAt ? (row.lastRunAt instanceof Date ? row.lastRunAt.toISOString() : String(row.lastRunAt)) : null,
      lastRunId: row.lastRunId ?? null,
      nextRunAt: row.nextRunAt ? (row.nextRunAt instanceof Date ? row.nextRunAt.toISOString() : String(row.nextRunAt)) : null,
    };
  }
}

export const schedulerService = new SchedulerService();
