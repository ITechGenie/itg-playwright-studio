import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { schedulerLock } from '../db/schema.js';
import { eq, lt, or } from 'drizzle-orm';

// Stable pod identity for this process lifetime
const POD_ID = randomUUID();

const HEARTBEAT_INTERVAL_MS = 15_000;
const LOCK_TTL_MS = 30_000;

export class LeaderElection {
  private _isLeader = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private onBecomeLeader: (() => void) | null = null;
  private onLoseLeader: (() => void) | null = null;

  get podId() { return POD_ID; }

  isLeader(): boolean {
    return this._isLeader;
  }

  start(onBecomeLeader: () => void, onLoseLeader: () => void): void {
    this.onBecomeLeader = onBecomeLeader;
    this.onLoseLeader = onLoseLeader;

    // Try immediately on start, then on interval
    this._tick();
    this.intervalHandle = setInterval(() => this._tick(), HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    if (this._isLeader) {
      this._isLeader = false;
      this.onLoseLeader?.();
    }
  }

  /**
   * Attempts to acquire or renew the scheduler lock atomically.
   * Returns true if this pod holds the lock after the attempt.
   */
  async tryAcquire(): Promise<boolean> {
    const now = new Date();
    const expires = new Date(now.getTime() + LOCK_TTL_MS);

    try {
      // Atomic upsert: only claim/renew if lock is expired OR we already hold it
      const result = await db
        .insert(schedulerLock)
        .values({ lockKey: 'leader', holderId: POD_ID, expiresAt: expires })
        .onConflictDoUpdate({
          target: schedulerLock.lockKey,
          set: { holderId: POD_ID, expiresAt: expires },
          setWhere: or(
            lt(schedulerLock.expiresAt, now),
            eq(schedulerLock.holderId, POD_ID)
          ),
        });

      // libsql returns rowsAffected
      return (result as any).rowsAffected > 0;
    } catch (err) {
      console.error('[LeaderElection] lock attempt failed:', err);
      return false;
    }
  }

  private async _tick(): Promise<void> {
    const acquired = await this.tryAcquire();

    if (acquired && !this._isLeader) {
      console.log(`[LeaderElection] Pod ${POD_ID.slice(0, 8)} became leader`);
      this._isLeader = true;
      this.onBecomeLeader?.();
    } else if (!acquired && this._isLeader) {
      console.log(`[LeaderElection] Pod ${POD_ID.slice(0, 8)} lost leadership`);
      this._isLeader = false;
      this.onLoseLeader?.();
    }
  }
}

export const leaderElection = new LeaderElection();
