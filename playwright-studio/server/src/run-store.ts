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
}

class RunStore {
  private runs: Map<string, TestRun> = new Map();
  private maxRuns = 100;

  getRun(runId: string): TestRun | undefined {
    return this.runs.get(runId);
  }

  createRun(projectId: string, runId: string, path: string, command: string): TestRun {
    const newRun: TestRun = {
      runId,
      projectId,
      path,
      command,
      status: 'running',
      startTime: new Date().toISOString(),
      logs: [],
    };
    
    // Maintain max history size
    if (this.runs.size >= this.maxRuns) {
      const oldestKey = this.runs.keys().next().value;
      if (oldestKey) this.runs.delete(oldestKey);
    }
    
    this.runs.set(runId, newRun);
    return newRun;
  }

  addLog(runId: string, type: RunLog['type'], data: string, exitCode?: number) {
    const run = this.runs.get(runId);
    if (!run) return;

    run.logs.push({
      timestamp: new Date().toISOString(),
      type,
      data,
      exitCode,
    });

    if (type === 'done' || type === 'error') {
      run.status = type === 'done' && exitCode === 0 ? 'completed' : 'failed';
      run.endTime = new Date().toISOString();
      run.exitCode = exitCode;
    }
  }

  getRecentRuns(projectId: string): TestRun[] {
    return Array.from(this.runs.values())
      .filter(r => r.projectId === projectId)
      .sort((a, b) => b.startTime.localeCompare(a.startTime));
  }
}

export const runStore = new RunStore();
