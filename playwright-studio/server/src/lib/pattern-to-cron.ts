export type ScheduleFrequency = 'interval' | 'daily' | 'weekly' | 'monthly';

export interface SchedulePattern {
  frequency: ScheduleFrequency;
  // interval
  intervalValue?: number;
  intervalUnit?: 'minutes' | 'hours';
  // daily
  dailyTime?: string;       // "HH:mm"
  // weekly
  weeklyDays?: number[];    // 0=Sun … 6=Sat
  weeklyTime?: string;      // "HH:mm"
  // monthly
  monthlyDay?: number;      // 1-31
  monthlyTime?: string;     // "HH:mm"
}

export interface RunConfig {
  browsers: string[];
  headless: boolean;
  workers: number;
  width: number;
  height: number;
  baseURL: string;
  video: 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';
  screenshot: 'off' | 'on' | 'only-on-failure';
  timeout: number;
  envId?: string;
  dataSetIds?: string[];
}

export interface Schedule {
  id: string;
  projectId: string;
  name: string;
  targetPaths: string[];
  config: RunConfig;
  pattern: SchedulePattern;
  cronExpression: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt: string | null;
  lastRunId: string | null;
  nextRunAt: string | null;
}

export const DEFAULT_RUN_CONFIG: RunConfig = {
  browsers: ['chromium'],
  headless: true,
  workers: 1,
  width: 1280,
  height: 720,
  baseURL: 'http://localhost:5173',
  video: 'retain-on-failure',
  screenshot: 'only-on-failure',
  timeout: 30000,
};

/**
 * Converts a SchedulePattern to a 5-part cron expression string.
 * Preconditions: pattern must be a valid SchedulePattern for its frequency.
 * Postconditions: returns exactly 5 space-separated cron parts.
 */
export function patternToCron(pattern: SchedulePattern): string {
  switch (pattern.frequency) {
    case 'interval': {
      const val = pattern.intervalValue ?? 30;
      if (pattern.intervalUnit === 'hours') {
        return `0 */${val} * * *`;
      }
      return `*/${val} * * * *`;
    }
    case 'daily': {
      const [h, m] = (pattern.dailyTime ?? '09:00').split(':');
      return `${parseInt(m)} ${parseInt(h)} * * *`;
    }
    case 'weekly': {
      const [h, m] = (pattern.weeklyTime ?? '09:00').split(':');
      const days = (pattern.weeklyDays ?? [1]).join(',');
      return `${parseInt(m)} ${parseInt(h)} * * ${days}`;
    }
    case 'monthly': {
      const [h, m] = (pattern.monthlyTime ?? '09:00').split(':');
      const day = pattern.monthlyDay ?? 1;
      return `${parseInt(m)} ${parseInt(h)} ${day} * *`;
    }
    default:
      throw new Error(`Unknown frequency: ${(pattern as any).frequency}`);
  }
}

/**
 * Returns a human-readable description of a SchedulePattern.
 */
export function patternToHuman(pattern: SchedulePattern): string {
  switch (pattern.frequency) {
    case 'interval': {
      const val = pattern.intervalValue ?? 30;
      const unit = pattern.intervalUnit ?? 'minutes';
      return `Every ${val} ${unit}`;
    }
    case 'daily':
      return `Daily at ${pattern.dailyTime ?? '09:00'}`;
    case 'weekly': {
      const days = (pattern.weeklyDays ?? [1])
        .map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
        .join(', ');
      return `Weekly on ${days} at ${pattern.weeklyTime ?? '09:00'}`;
    }
    case 'monthly':
      return `Monthly on day ${pattern.monthlyDay ?? 1} at ${pattern.monthlyTime ?? '09:00'}`;
    default:
      return 'Custom schedule';
  }
}

/**
 * Validates a SchedulePattern and returns an error string or null.
 */
export function validatePattern(pattern: SchedulePattern): string | null {
  switch (pattern.frequency) {
    case 'interval': {
      const val = pattern.intervalValue;
      if (!val || val < 1) return 'Interval value must be at least 1';
      if (pattern.intervalUnit === 'minutes' && val > 59) return 'Minute interval must be 1–59';
      if (pattern.intervalUnit === 'hours' && val > 23) return 'Hour interval must be 1–23';
      return null;
    }
    case 'daily':
      if (!pattern.dailyTime || !/^\d{2}:\d{2}$/.test(pattern.dailyTime)) return 'Daily time must be HH:mm';
      return null;
    case 'weekly':
      if (!pattern.weeklyDays || pattern.weeklyDays.length === 0) return 'Select at least one day';
      if (!pattern.weeklyTime || !/^\d{2}:\d{2}$/.test(pattern.weeklyTime)) return 'Weekly time must be HH:mm';
      return null;
    case 'monthly':
      if (!pattern.monthlyDay || pattern.monthlyDay < 1 || pattern.monthlyDay > 31) return 'Day must be 1–31';
      if (!pattern.monthlyTime || !/^\d{2}:\d{2}$/.test(pattern.monthlyTime)) return 'Monthly time must be HH:mm';
      return null;
    default:
      return 'Unknown frequency';
  }
}
