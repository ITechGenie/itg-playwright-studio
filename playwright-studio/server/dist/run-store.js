"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runStore = void 0;
class RunStore {
    runs = new Map();
    maxRuns = 100;
    getRun(runId) {
        return this.runs.get(runId);
    }
    createRun(projectId, runId, path, command) {
        const newRun = {
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
            if (oldestKey)
                this.runs.delete(oldestKey);
        }
        this.runs.set(runId, newRun);
        return newRun;
    }
    addLog(runId, type, data, exitCode) {
        const run = this.runs.get(runId);
        if (!run)
            return;
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
    getRecentRuns(projectId) {
        return Array.from(this.runs.values())
            .filter(r => r.projectId === projectId)
            .sort((a, b) => b.startTime.localeCompare(a.startTime));
    }
}
exports.runStore = new RunStore();
