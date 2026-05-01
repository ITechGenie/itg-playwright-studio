import { db } from './db/index.js';
import { executions, testResults } from './db/schema.js';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
export interface RunLog {
  timestamp: string;
  type: 'stdout' | 'stderr' | 'info' | 'done' | 'error';
  data: string;
  exitCode?: number;
}

export interface TestRun {
  runId: string;
  projectId: string;
  path: string;
  command: string;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  logs: RunLog[];
  exitCode?: number;
  triggeredBy?: string;
  targetPaths?: string[];
}

class RunStore {
  // We still keep logs in memory for ACTIVE runs to avoid DB bloat
  // or reading files constantly during execution. 
  // For finished runs, we'll fetch metadata from DB.
  private activeLogs: Map<string, RunLog[]> = new Map();

  /**
   * Called on server startup — marks any runs still in 'running' state as 'failed'.
   * These are orphans from a previous server crash or restart.
   */
  async cleanupOrphanedRuns(): Promise<void> {
    const now = new Date();
    const result = await db
      .update(executions)
      .set({
        status: 'failed',
        endTime: now,
        exitCode: -1,
        duration: null,
      })
      .where(eq(executions.status, 'running'));

    const count = (result as any)?.rowsAffected ?? 0;
    if (count > 0) {
      console.log(`[RunStore] Marked ${count} orphaned run(s) as failed on startup`);
    }
  }

  async getRun(runId: string): Promise<TestRun | undefined> {
    const [record] = await db.select().from(executions).where(eq(executions.id, runId));
    if (!record) return undefined;

    return {
      runId: record.id,
      projectId: record.projectId,
      path: record.targetPath,
      command: record.command,
      status: record.status as any,
      startTime: record.startTime.toISOString(),
      endTime: record.endTime?.toISOString(),
      triggeredBy: record.triggeredBy,
      exitCode: record.exitCode ?? undefined,
      logs: this.activeLogs.get(record.id) || [],
      targetPaths: record.targetPaths ? JSON.parse(record.targetPaths) : undefined,
    };
  }

  async createRun(projectId: string, runId: string, path: string, command: string, triggeredBy: string = 'anonymous', targetPaths?: string[]): Promise<void> {
    await db.insert(executions).values({
      id: runId,
      projectId,
      targetPath: path,
      command,
      status: 'running',
      startTime: new Date(),
      triggeredBy,
      targetPaths: targetPaths ? JSON.stringify(targetPaths) : null,
    });
    
    this.activeLogs.set(runId, []);
  }

  async addLog(runId: string, type: RunLog['type'], data: string, exitCode?: number) {
    // Update memory logs for active run
    const logs = this.activeLogs.get(runId) || [];
    logs.push({
      timestamp: new Date().toISOString(),
      type,
      data,
      exitCode,
    });
    this.activeLogs.set(runId, logs);

    // If finished, update DB metadata
    if (type === 'done' || type === 'error') {
      const status = type === 'done' && exitCode === 0 ? 'completed' : 'failed';
      const now = new Date();
      
      // Calculate duration if possible
      const [run] = await db.select().from(executions).where(eq(executions.id, runId));
      let duration = null;
      if (run) {
        duration = now.getTime() - run.startTime.getTime();
      }

      await db.update(executions).set({
        status,
        endTime: now,
        exitCode: exitCode ?? (type === 'error' ? -1 : 0),
        duration,
      }).where(eq(executions.id, runId));

      // Parse results.json and persist per-test results
      if (run) {
        await this._persistTestResults(runId, run.projectId).catch(err => {
          console.warn(`[RunStore] Failed to persist test results for ${runId}:`, err?.message ?? err);
        });
      }

      // In a real app, we might dump logs to a file here and clear memory
      // this.activeLogs.delete(runId);
    }
  }

  /**
   * Reads results.json produced by the Playwright JSON reporter and bulk-inserts
   * one row per test case into the test_results table.
   */
  private async _persistTestResults(runId: string, projectId: string): Promise<void> {
    const executionsPath = process.env.EXECUTIONS_BASE_PATH || path.join(process.cwd(), 'executions');
    const resultsFile = path.join(executionsPath, projectId, 'runs', runId, 'report', 'results.json');

    let raw: string;
    try {
      raw = await fs.readFile(resultsFile, 'utf8');
    } catch {
      // results.json not present (e.g. run was stopped before Playwright finished)
      return;
    }

    let report: PlaywrightJsonReport;
    try {
      report = JSON.parse(raw);
    } catch {
      console.warn(`[RunStore] results.json for ${runId} is not valid JSON`);
      return;
    }

    const rows: (typeof testResults.$inferInsert)[] = [];

    for (const suite of report.suites ?? []) {
      collectTestRows(suite, suite.title ?? '', runId, projectId, rows);
    }

    if (rows.length === 0) return;

    // Batch insert in chunks of 100 to avoid hitting SQLite variable limits
    const CHUNK = 100;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await db.insert(testResults).values(rows.slice(i, i + CHUNK));
    }

    console.log(`[RunStore] Persisted ${rows.length} test result(s) for run ${runId}`);
  }

  async getRecentRuns(projectId: string, options: { 
    limit?: number; 
    offset?: number; 
    status?: string; 
    startDate?: Date; 
    endDate?: Date;
  } = {}): Promise<any[]> {
    const { limit = 10, offset = 0, status, startDate, endDate } = options;
    
    let whereClause = eq(executions.projectId, projectId);
    
    const conditions: any[] = [whereClause];
    if (status && status !== 'all') {
      conditions.push(eq(executions.status, status.toLowerCase()));
    }
    if (startDate) {
      conditions.push(gte(executions.startTime, startDate));
    }
    if (endDate) {
      conditions.push(lte(executions.startTime, endDate));
    }

    const results = await db.select()
      .from(executions)
      .where(and(...conditions))
      .orderBy(desc(executions.startTime))
      .limit(limit)
      .offset(offset);

    return results.map(record => ({
      runId: record.id,
      projectId: record.projectId,
      timestamp: record.startTime.toISOString(),
      status: record.status,
      command: record.command,
      duration: record.duration,
      triggeredBy: record.triggeredBy,
      path: record.targetPath,
      targetPaths: record.targetPaths ? JSON.parse(record.targetPaths) : undefined,
    }));
  }
}

export const runStore = new RunStore();

// ── Playwright JSON report types ──────────────────────────────────────────────

interface PlaywrightJsonReport {
  suites?: PlaywrightSuite[];
}

interface PlaywrightSuite {
  title?: string;
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: PlaywrightSpec[];
}

interface PlaywrightSpec {
  title?: string;
  file?: string;
  tests?: PlaywrightTest[];
}

interface PlaywrightTest {
  projectName?: string;
  status?: string;
  duration?: number;
  results?: PlaywrightTestResult[];
}

interface PlaywrightTestResult {
  status?: string;
  duration?: number;
  startTime?: string;
  retry?: number;
  errors?: { message?: string; stack?: string }[];
}

// ── Helper: recursively collect test rows from nested suites ──────────────────

function collectTestRows(
  suite: PlaywrightSuite,
  filePath: string,
  executionId: string,
  projectId: string,
  rows: (typeof testResults.$inferInsert)[],
): void {
  // Recurse into nested suites
  for (const child of suite.suites ?? []) {
    collectTestRows(child, suite.file ?? filePath, executionId, projectId, rows);
  }

  for (const spec of suite.specs ?? []) {
    const suiteName = spec.file ?? suite.file ?? filePath;
    const testTitle = spec.title ?? '';

    for (const test of spec.tests ?? []) {
      const browser = test.projectName ?? null;

      // Playwright reports one result per retry attempt; the last one is the final outcome
      const results = test.results ?? [];
      const finalResult = results[results.length - 1];
      if (!finalResult) continue;

      const status = normaliseStatus(finalResult.status ?? test.status ?? 'unknown');
      const duration = finalResult.duration ?? test.duration ?? null;
      const retries = Math.max(0, results.length - 1);
      const startedAt = finalResult.startTime ? new Date(finalResult.startTime) : null;

      const firstError = finalResult.errors?.[0];
      const errorMessage = firstError?.message
        ? firstError.message.slice(0, 500)
        : null;
      const errorStack = firstError?.stack ?? null;

      rows.push({
        id: randomUUID(),
        executionId,
        projectId,
        suiteName,
        testTitle,
        status,
        duration,
        retries,
        browser,
        errorMessage,
        errorStack,
        startedAt,
      });
    }
  }
}

function normaliseStatus(raw: string): string {
  switch (raw) {
    case 'passed': return 'passed';
    case 'failed': return 'failed';
    case 'timedOut': return 'timedOut';
    case 'skipped':
    case 'pending': return 'skipped';
    default: return 'failed';
  }
}
