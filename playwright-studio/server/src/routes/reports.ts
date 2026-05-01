import { Router } from 'express';
import { db } from '../db/index.js';
import { projects, executions, testResults } from '../db/schema.js';
import { eq, and, gte, desc } from 'drizzle-orm';

export function createReportsRouter() {
  const router = Router();

  /**
   * GET /apis/project/:projectId/reports/summary
   *
   * Query params:
   *   days    — 7 | 30 | 90 (default 30)
   *   trigger — "all" | "manual" | "scheduler:<name>" (default "all")
   *   status  — "all" | "completed" | "failed" (default "all")
   */
  router.get('/:projectId/reports/summary', async (req, res) => {
    const { projectId } = req.params;
    const rawDays = parseInt(req.query.days as string);
    const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;
    const triggerFilter = (req.query.trigger as string) || 'all';
    const statusFilter = (req.query.status as string) || 'all';

    // Verify project exists
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const now = new Date();
    const rangeStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Fetch all executions in range for this project
    let rows = await db
      .select()
      .from(executions)
      .where(and(eq(executions.projectId, projectId), gte(executions.startTime, rangeStart)));

    // ── Apply filters ─────────────────────────────────────────────────────────

    if (triggerFilter !== 'all') {
      if (triggerFilter === 'manual') {
        // Manual = anything that does NOT start with "scheduler:"
        rows = rows.filter(r => !r.triggeredBy.startsWith('scheduler:'));
      } else {
        // Exact match on triggeredBy (e.g. "scheduler:Daily Smoke")
        rows = rows.filter(r => r.triggeredBy === triggerFilter);
      }
    }

    if (statusFilter !== 'all') {
      rows = rows.filter(r => r.status === statusFilter);
    }

    // ── Summary metrics ───────────────────────────────────────────────────────

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

    // ── statusOverTime — zero-filled daily buckets ────────────────────────────

    const statusByDay: Record<string, { completed: number; failed: number; stopped: number }> = {};
    for (const row of rows) {
      const dateStr = toDateStr(new Date(row.startTime));
      if (!statusByDay[dateStr]) statusByDay[dateStr] = { completed: 0, failed: 0, stopped: 0 };
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

    // ── durationTrend — only days with completed runs ─────────────────────────

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

    // ── statusBreakdown ───────────────────────────────────────────────────────

    const runningCount = rows.filter(r => r.status === 'running').length;
    const statusBreakdown = {
      completed: completedCount,
      failed: failedCount,
      stopped: stoppedCount,
      running: runningCount,
    };

    // ── topFailingPaths (run-level) ───────────────────────────────────────────

    const failsByPath: Record<string, { failCount: number; lastFailed: Date | null }> = {};
    for (const row of rows) {
      if (row.status === 'failed') {
        let pathsToCount: string[] = [];
        if (row.targetPaths) {
          try {
            const parsed = typeof row.targetPaths === 'string' ? JSON.parse(row.targetPaths) : row.targetPaths;
            if (Array.isArray(parsed) && parsed.length > 0) {
              pathsToCount = parsed;
            }
          } catch (e) {
            // ignore parse error
          }
        }
        if (pathsToCount.length === 0) {
          pathsToCount = [row.targetPath || 'Root Project'];
        }

        for (const p of pathsToCount) {
          if (!failsByPath[p]) failsByPath[p] = { failCount: 0, lastFailed: null };
          failsByPath[p].failCount++;
          const st = new Date(row.startTime);
          if (!failsByPath[p].lastFailed || st > failsByPath[p].lastFailed!) {
            failsByPath[p].lastFailed = st;
          }
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

    // ── runsByTrigger ─────────────────────────────────────────────────────────

    const triggerCounts: Record<string, number> = {};
    for (const row of rows) {
      const t = row.triggeredBy || 'anonymous';
      triggerCounts[t] = (triggerCounts[t] ?? 0) + 1;
    }

    const runsByTrigger = Object.entries(triggerCounts).map(([trigger, count]) => ({
      trigger,
      count,
    }));

    // ── availableTriggers — for populating the filter dropdown ────────────────
    // Fetch all distinct triggeredBy values in the time range (unfiltered)
    const allRowsForTriggers = await db
      .select({ triggeredBy: executions.triggeredBy })
      .from(executions)
      .where(and(eq(executions.projectId, projectId), gte(executions.startTime, rangeStart)));

    const triggerSet = new Set(allRowsForTriggers.map(r => r.triggeredBy));
    const availableTriggers = Array.from(triggerSet).sort();

    // ── Per-test aggregations from test_results ───────────────────────────────

    const executionIds = rows.map(r => r.id);

    let testRows: (typeof testResults.$inferSelect)[] = [];
    if (executionIds.length > 0) {
      // Fetch all test results for the filtered executions
      // We query by projectId + rangeStart to avoid huge IN clauses
      const allTestRows = await db
        .select()
        .from(testResults)
        .where(and(eq(testResults.projectId, projectId), gte(testResults.startedAt, rangeStart)))
        .orderBy(desc(testResults.startedAt));

      // Filter to only the execution IDs we care about (post-filter)
      const idSet = new Set(executionIds);
      testRows = allTestRows.filter(r => idSet.has(r.executionId));
    }

    // topFailingTests — top 10 test titles by fail count
    const failsByTest: Record<string, {
      suiteName: string;
      browser: string | null;
      failCount: number;
      lastFailed: Date | null;
      lastErrorMessage: string | null;
    }> = {};

    for (const r of testRows) {
      if (r.status === 'failed' || r.status === 'timedOut') {
        const key = `${r.suiteName}::${r.testTitle}`;
        if (!failsByTest[key]) {
          failsByTest[key] = {
            suiteName: r.suiteName,
            browser: r.browser,
            failCount: 0,
            lastFailed: null,
            lastErrorMessage: null,
          };
        }
        failsByTest[key].failCount++;
        const st = r.startedAt ? new Date(r.startedAt) : null;
        if (st && (!failsByTest[key].lastFailed || st > failsByTest[key].lastFailed!)) {
          failsByTest[key].lastFailed = st;
          failsByTest[key].lastErrorMessage = r.errorMessage;
        }
      }
    }

    const topFailingTests = Object.entries(failsByTest)
      .sort((a, b) => b[1].failCount - a[1].failCount)
      .slice(0, 10)
      .map(([key, v]) => ({
        testTitle: key.split('::').slice(1).join('::'),
        suiteName: v.suiteName,
        browser: v.browser,
        failCount: v.failCount,
        lastFailed: v.lastFailed ? v.lastFailed.toISOString() : null,
        lastErrorMessage: v.lastErrorMessage,
      }));

    // flakyTests — tests that had retries but eventually passed
    const flakyMap: Record<string, {
      suiteName: string;
      passCount: number;
      failCount: number;
      totalRetries: number;
    }> = {};

    for (const r of testRows) {
      if (r.retries > 0) {
        const key = `${r.suiteName}::${r.testTitle}`;
        if (!flakyMap[key]) flakyMap[key] = { suiteName: r.suiteName, passCount: 0, failCount: 0, totalRetries: 0 };
        if (r.status === 'passed') flakyMap[key].passCount++;
        else flakyMap[key].failCount++;
        flakyMap[key].totalRetries += r.retries;
      }
    }

    const flakyTests = Object.entries(flakyMap)
      .filter(([, v]) => v.passCount > 0) // only tests that eventually passed after retries
      .sort((a, b) => b[1].totalRetries - a[1].totalRetries)
      .slice(0, 10)
      .map(([key, v]) => ({
        testTitle: key.split('::').slice(1).join('::'),
        suiteName: v.suiteName,
        passCount: v.passCount,
        failCount: v.failCount,
        totalRetries: v.totalRetries,
      }));

    // failureReasons — group error messages by type
    const reasonMap: Record<string, number> = {};
    for (const r of testRows) {
      if ((r.status === 'failed' || r.status === 'timedOut') && r.errorMessage) {
        const reason = classifyError(r.errorMessage);
        reasonMap[reason] = (reasonMap[reason] ?? 0) + 1;
      }
    }

    const failureReasons = Object.entries(reasonMap)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, count }));

    // ── Response ──────────────────────────────────────────────────────────────

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
      availableTriggers,
      topFailingTests,
      flakyTests,
      failureReasons,
    });
  });

  return router;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDailyBuckets(rangeStart: Date, now: Date): string[] {
  const buckets: string[] = [];
  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  while (cursor <= end) {
    buckets.push(toDateStr(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

/**
 * Classify an error message into a human-readable category.
 * Keeps the report chart readable by grouping similar errors.
 */
function classifyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('timeout') || m.includes('timed out')) return 'Timeout';
  if (m.includes('net::err') || m.includes('network') || m.includes('fetch')) return 'Network Error';
  if (m.includes('expect(') || m.includes('tobevisible') || m.includes('tohavetext') || m.includes('assertion')) return 'Assertion Failed';
  if (m.includes('locator') || m.includes('element') || m.includes('selector')) return 'Element Not Found';
  if (m.includes('navigation') || m.includes('page.goto')) return 'Navigation Error';
  if (m.includes('typeerror') || m.includes('referenceerror') || m.includes('syntaxerror')) return 'JS Error';
  if (m.includes('401') || m.includes('403') || m.includes('unauthorized')) return 'Auth Error';
  if (m.includes('500') || m.includes('502') || m.includes('503')) return 'Server Error';
  return 'Other';
}
