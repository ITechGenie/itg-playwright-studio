"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runQueue = exports.RunQueue = void 0;
const events_1 = require("events");
/**
 * Manages a FIFO queue of test runs with configurable parallelism.
 * Ensures only MAX_PARALLEL_RUNS execute concurrently.
 */
class RunQueue extends events_1.EventEmitter {
    queue = [];
    running = new Set();
    maxParallel;
    constructor(maxParallel = 2) {
        super();
        this.maxParallel = maxParallel;
    }
    /**
     * Add a run to the queue. If slots available, starts immediately.
     */
    enqueue(run) {
        console.log(`[QUEUE] Enqueueing run ${run.runId} for project ${run.projectId}`);
        this.queue.push(run);
        this.emit('queued', run);
        console.log(`[QUEUE] Current status: ${this.running.size} running, ${this.queue.length} queued`);
        this.processQueue();
    }
    /**
     * Process queued runs up to MAX_PARALLEL_RUNS limit.
     */
    async processQueue() {
        console.log(`[QUEUE] Processing queue... (${this.running.size}/${this.maxParallel} slots used)`);
        while (this.running.size < this.maxParallel && this.queue.length > 0) {
            const run = this.queue.shift();
            if (!run)
                break;
            console.log(`[QUEUE] Starting run ${run.runId}`);
            this.running.add(run.runId);
            this.emit('started', run);
            // Execute asynchronously
            run.execute()
                .catch(err => {
                console.error(`[QUEUE] Run ${run.runId} failed:`, err);
                this.emit('error', run, err);
            })
                .finally(() => {
                console.log(`[QUEUE] Run ${run.runId} completed`);
                this.running.delete(run.runId);
                this.emit('completed', run);
                // Process next in queue
                this.processQueue();
            });
        }
        if (this.queue.length === 0 && this.running.size === 0) {
            console.log('[QUEUE] Queue is empty, all runs completed');
        }
    }
    /**
     * Get current queue status.
     */
    getStatus() {
        return {
            queued: this.queue.length,
            running: this.running.size,
            maxParallel: this.maxParallel,
        };
    }
    /**
     * Check if a specific run is queued or running.
     */
    isActive(runId) {
        return this.running.has(runId) || this.queue.some(r => r.runId === runId);
    }
}
exports.RunQueue = RunQueue;
// Global singleton queue instance
exports.runQueue = new RunQueue(parseInt(process.env.MAX_PARALLEL_RUNS || '2'));
