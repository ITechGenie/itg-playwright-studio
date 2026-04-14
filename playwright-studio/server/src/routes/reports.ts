import { Router } from 'express';
import { db } from '../db/index.js';
import { projects, executions } from '../db/schema.js';
import { eq, and, gte } from 'drizzle-orm';

export function createReportsRouter() {
  const router = Router();

  /**
   * GET /apis/project/:projectId/reports/summary
   * Returns aggregated execution metrics for the given project and time range.
   */
  router.get('/:projectId/reports/summary', async (req, res) => {
    const { projectId } = req.params;
    const rawDays = parseInt(req.query.days as string);
    const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;

    // 1.8 — Verify project exists (404 if not)
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const now = new Date();
    const rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Fetch all executions in range for this project
    const rows = await db
      .select()
      .from(executions)
      .where(
        and(
          eq(executions.projectId, projectId),
          gte(executions.startTime, rangeStart),
        ),
      );

    // ── 1.2 Summary metrics ──────────────────────────────────────────────────

    const totalRuns = rows.length;

    const completedCount = rows.filter(r => r.status === 'completed').length;
    const failedCount = rows.filter(r => r.status === 'failed').length;
    const stoppedCount = rows.filter(r => r.status === 'stopped').length;
    const nonRunning = completedCount + failedCount + stoppedCount;

    const passRate = nonRunning > 0 ? Math.floor((completedCount / nonRunning) * 100) : 0;

    const durRows = rows.filter(r => r.duration != null);
    const avgDurationMs =
      durRows.length > 0
        ? durRows.reduce((sum, r) => sum + (r.duration as number), 0) / durRows.length
        : null;

    const sortedByStart = [...rows].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
    );
    const lastRunAt = sortedByStart.length > 0 ? sortedByStart[0].startTime : null;

    // ── 1.3 statusOverTime — zero-filled daily buckets ───────────────────────

    // Build a map: dateStr -> { completed, failed, stopped }
    const statusByDay: Record<string, { completed: number; failed: number; stopped: number }> = {};

    for (const row of rows) {
      const dateStr = toDateStr(new Date(row.startTime));
      if (!statusByDay[dateStr]) {
        statusByDay[dateStr] = { completed: 0, failed: 0, stopped: 0 };
      }
      if (row.status === 'completed') statusByDay[dateStr].completed++;
      else if (row.status === 'failed') statusByDay[dateStr].failed++;
      else if (row.status === 'stopped') statusByDay[dateStr].stopped++;
    }

    const statusOverTime = buildDailyBuckets(rangeStart, now).map(dateStr => ({
      date: dateStr,
      completed: statusByDay[dateStr]?.completed ?? 0,
      failed: statusByDay[dateStr]?.failed ?? 0,
      stopped: statusByDay[dateStr]?.stopped ?? 0,
    }));

    // ── 1.4 durationTrend — only days with completed runs ────────────────────

    const durationByDay: Record<string, { total: number; count: number }> = {};

    for (const row of rows) {
      if (row.status === 'completed' && row.duration != null) {
        const dateStr = toDateStr(new Date(row.startTime));
        if (!durationByDay[dateStr]) durationByDay[dateStr] = { total: 0, count: 0 };
        durationByDay[dateStr].total += row.duration as number;
        durationByDay[dateStr].count++;
      }
    }

    const durationTrend = Object.entries(durationByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, count }]) => ({
        date,
        avgDurationSec: Math.round((total / count / 1000) * 10) / 10,
      }));

    // ── 1.5 statusBreakdown ──────────────────────────────────────────────────

    const runningCount = rows.filter(r => r.status === 'running').length;
    const statusBreakdown = {
      completed: completedCount,
      failed: failedCount,
      stopped: stoppedCount,
      running: runningCount,
    };

    // ── 1.6 topFailingPaths ──────────────────────────────────────────────────

    const failsByPath: Record<string, { failCount: number; lastFailed: Date | null }> = {};

    for (const row of rows) {
      if (row.status === 'failed') {
        const p = row.targetPath;
        if (!failsByPath[p]) failsByPath[p] = { failCount: 0, lastFailed: null };
        failsByPath[p].failCount++;
        const st = new Date(row.startTime);
        if (!failsByPath[p].lastFailed || st > failsByPath[p].lastFailed!) {
          failsByPath[p].lastFailed = st;
        }
      }
    }

    const topFailingPaths = Object.entries(failsByPath)
      .sort((a, b) => b[1].failCount - a[1].failCount)
      .slice(0, 10)
      .map(([targetPath, { failCount, lastFailed }]) => ({
        targetPath,
        failCount,
        lastFailed: lastFailed ? lastFailed.toISOString() : null,
      }));

    // ── 1.7 runsByTrigger ────────────────────────────────────────────────────

    const triggerCounts: Record<string, number> = {};
    for (const row of rows) {
      const t = row.triggeredBy || 'anonymous';
      triggerCounts[t] = (triggerCounts[t] ?? 0) + 1;
    }

    const runsByTrigger = Object.entries(triggerCounts).map(([trigger, count]) => ({
      trigger,
      count,
    }));

    // ── Response ─────────────────────────────────────────────────────────────

    return res.json({
      totalRuns,
      passRate,
      avgDurationMs,
      lastRunAt: lastRunAt ? new Date(lastRunAt).toISOString() : null,
      statusOverTime,
      durationTrend,
      statusBreakdown,
      topFailingPaths,
      runsByTrigger,
    });
  });

  return router;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date as "YYYY-MM-DD" in local time */
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Return an array of "YYYY-MM-DD" strings for every day from rangeStart to now (inclusive) */
function buildDailyBuckets(rangeStart: Date, now: Date): string[] {
  const buckets: string[] = [];
  const cursor = new Date(rangeStart);
  // Normalise to start of day
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    buckets.push(toDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}
