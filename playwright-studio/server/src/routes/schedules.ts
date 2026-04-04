import { Router } from 'express';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { schedules, projects } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { schedulerService } from '../lib/scheduler-service.js';
import { triggerRun } from '../lib/trigger-run.js';
import {
  patternToCron,
  patternToHuman,
  validatePattern,
  Schedule,
  SchedulePattern,
  RunConfig,
} from '../lib/pattern-to-cron.js';

export function createSchedulesRouter() {
  const router = Router();

  // ── Helpers ──────────────────────────────────────────────────────────────

  function rowToSchedule(row: any): Schedule {
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

  function validatePaths(targetPaths: string[], projectRoot: string): string | null {
    for (const p of targetPaths) {
      const full = path.resolve(projectRoot, p);
      if (!full.startsWith(projectRoot)) return p;
    }
    return null;
  }

  function validateConfig(config: RunConfig): string | null {
    if (config.workers !== undefined && (config.workers < 1 || config.workers > 16))
      return 'workers must be between 1 and 16';
    if (config.timeout !== undefined && (config.timeout < 5000 || config.timeout > 300000))
      return 'timeout must be between 5000 and 300000 ms';
    return null;
  }

  // ── GET /:projectId/schedules ─────────────────────────────────────────────
  router.get('/:projectId/schedules', async (req, res) => {
    const { projectId } = req.params;
    try {
      const rows = await db.select().from(schedules).where(eq(schedules.projectId, projectId));
      res.json(rows.map(rowToSchedule));
    } catch (err) {
      console.error('[Schedules] GET error:', err);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });

  // ── POST /:projectId/schedules ────────────────────────────────────────────
  router.post('/:projectId/schedules', async (req, res) => {
    const { projectId } = req.params;
    const { name, targetPaths = [], config, pattern } = req.body as {
      name: string;
      targetPaths: string[];
      config: RunConfig;
      pattern: SchedulePattern;
    };

    // Validate name
    if (!name || name.trim().length === 0)
      return res.status(400).json({ error: 'Name is required' });
    if (name.length > 100)
      return res.status(400).json({ error: 'Name must be 100 characters or fewer' });

    // Validate config
    const configErr = validateConfig(config);
    if (configErr) return res.status(400).json({ error: configErr });

    // Validate pattern
    const patternErr = validatePattern(pattern);
    if (patternErr) return res.status(400).json({ error: patternErr });

    // Validate paths (path traversal)
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const basePath = process.env.PROJECTS_BASE_PATH || 'projects';
    const projectRoot = path.resolve(basePath, project.name);

    if (targetPaths.length > 0) {
      const badPath = validatePaths(targetPaths, projectRoot);
      if (badPath) return res.status(403).json({ error: `Forbidden: path traversal detected: ${badPath}` });
    }

    // Generate cron
    let cronExpression: string;
    try {
      cronExpression = patternToCron(pattern);
    } catch {
      return res.status(400).json({ error: 'Invalid schedule pattern' });
    }

    const id = randomUUID();
    const now = new Date();
    const nextRunAt = schedulerService.getNextRunTime(cronExpression);

    try {
      await db.insert(schedules).values({
        id,
        projectId,
        name: name.trim(),
        targetPaths: JSON.stringify(targetPaths),
        config: JSON.stringify(config),
        pattern: JSON.stringify(pattern),
        cronExpression,
        enabled: 1,
        createdAt: now,
        nextRunAt,
      });

      const [row] = await db.select().from(schedules).where(eq(schedules.id, id));
      const schedule = rowToSchedule(row);

      // Register job if this pod is the leader
      schedulerService.registerJob(schedule);

      return res.status(201).json(schedule);
    } catch (err) {
      console.error('[Schedules] POST error:', err);
      return res.status(500).json({ error: 'Failed to create schedule' });
    }
  });

  // ── PATCH /:projectId/schedules/:scheduleId ───────────────────────────────
  router.patch('/:projectId/schedules/:scheduleId', async (req, res) => {
    const { projectId, scheduleId } = req.params;
    const patch = req.body as Partial<{
      name: string;
      config: RunConfig;
      pattern: SchedulePattern;
      enabled: boolean;
    }>;

    const [existing] = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
    if (!existing || existing.projectId !== projectId)
      return res.status(404).json({ error: 'Schedule not found' });

    const update: Record<string, any> = {};

    if (patch.name !== undefined) {
      if (!patch.name || patch.name.trim().length === 0)
        return res.status(400).json({ error: 'Name is required' });
      if (patch.name.length > 100)
        return res.status(400).json({ error: 'Name must be 100 characters or fewer' });
      update.name = patch.name.trim();
    }

    if (patch.config !== undefined) {
      const configErr = validateConfig(patch.config);
      if (configErr) return res.status(400).json({ error: configErr });
      update.config = JSON.stringify(patch.config);
    }

    if (patch.pattern !== undefined) {
      const patternErr = validatePattern(patch.pattern);
      if (patternErr) return res.status(400).json({ error: patternErr });
      try {
        update.cronExpression = patternToCron(patch.pattern);
        update.pattern = JSON.stringify(patch.pattern);
        update.nextRunAt = schedulerService.getNextRunTime(update.cronExpression);
      } catch {
        return res.status(400).json({ error: 'Invalid schedule pattern' });
      }
    }

    if (patch.enabled !== undefined) {
      update.enabled = patch.enabled ? 1 : 0;
    }

    try {
      await db.update(schedules).set(update).where(eq(schedules.id, scheduleId));
      const [row] = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
      const schedule = rowToSchedule(row);

      // Sync job registration
      if (schedule.enabled) {
        schedulerService.rescheduleJob(schedule);
      } else {
        schedulerService.unregisterJob(scheduleId);
      }

      return res.json(schedule);
    } catch (err) {
      console.error('[Schedules] PATCH error:', err);
      return res.status(500).json({ error: 'Failed to update schedule' });
    }
  });

  /**
   * POST /api/projects/:projectId/schedules/:scheduleId/run
   * Manually trigger a scheduled run immediately.
   */
  router.post('/:projectId/schedules/:scheduleId/run', async (req, res) => {
    const { projectId, scheduleId } = req.params;
    const user = (req as any).user?.email || (req as any).user?.id || 'manual';

    const [existing] = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
    if (!existing || existing.projectId !== projectId)
      return res.status(404).json({ error: 'Schedule not found' });

    try {
      const schedule = rowToSchedule(existing);
      const result = await triggerRun({
        projectId,
        targetPaths: schedule.targetPaths,
        config: schedule.config,
        triggeredBy: `manual:${user}`,
      });

      const now = new Date();
      const nextRun = schedulerService.getNextRunTime(schedule.cronExpression);
      await db.update(schedules)
        .set({ lastRunAt: now, lastRunId: result.runId, nextRunAt: nextRun })
        .where(eq(schedules.id, scheduleId));

      return res.status(201).json({ runId: result.runId, command: result.command });
    } catch (err: any) {
      console.error('[Schedules] manual run error:', err);
      return res.status(500).json({ error: err.message || 'Failed to trigger run' });
    }
  });
  router.delete('/:projectId/schedules/:scheduleId', async (req, res) => {
    const { projectId, scheduleId } = req.params;

    const [existing] = await db.select().from(schedules).where(eq(schedules.id, scheduleId));
    if (!existing || existing.projectId !== projectId)
      return res.status(404).json({ error: 'Schedule not found' });

    try {
      schedulerService.unregisterJob(scheduleId);
      await db.delete(schedules).where(eq(schedules.id, scheduleId));
      return res.status(204).send();
    } catch (err) {
      console.error('[Schedules] DELETE error:', err);
      return res.status(500).json({ error: 'Failed to delete schedule' });
    }
  });

  return router;
}
