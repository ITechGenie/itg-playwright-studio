import { db } from './db/index.js';
import { executions } from './db/schema.js';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
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

      // In a real app, we might dump logs to a file here and clear memory
      // this.activeLogs.delete(runId);
    }
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
