import { EventEmitter } from 'events';

export interface QueuedRun {
  runId: string;
  projectId: string;
  targetPath: string;
  execute: () => Promise<void>;
}

/**
 * Manages a FIFO queue of test runs with configurable parallelism.
 * Ensures only MAX_PARALLEL_RUNS execute concurrently.
 */
export class RunQueue extends EventEmitter {
  private queue: QueuedRun[] = [];
  private running = new Set<string>();
  private maxParallel: number;

  constructor(maxParallel: number = 2) {
    super();
    this.maxParallel = maxParallel;
  }

  /**
   * Add a run to the queue. If slots available, starts immediately.
   */
  enqueue(run: QueuedRun): void {
    console.log(`[QUEUE] Enqueueing run ${run.runId} for project ${run.projectId}`);
    this.queue.push(run);
    this.emit('queued', run);
    console.log(`[QUEUE] Current status: ${this.running.size} running, ${this.queue.length} queued`);
    this.processQueue();
  }

  /**
   * Process queued runs up to MAX_PARALLEL_RUNS limit.
   */
  private async processQueue(): Promise<void> {
    console.log(`[QUEUE] Processing queue... (${this.running.size}/${this.maxParallel} slots used)`);
    
    while (this.running.size < this.maxParallel && this.queue.length > 0) {
      const run = this.queue.shift();
      if (!run) break;

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
  isActive(runId: string): boolean {
    return this.running.has(runId) || this.queue.some(r => r.runId === runId);
  }
}

// Global singleton queue instance
export const runQueue = new RunQueue(
  parseInt(process.env.MAX_PARALLEL_RUNS || '2')
);
