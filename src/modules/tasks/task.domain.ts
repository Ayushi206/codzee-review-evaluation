import { TaskPriority, TaskStats, TaskStatus } from './task.types';

// allowed status changes (todo can't go straight to done)
const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ['in_progress'],
  in_progress: ['todo', 'done'],
  done: ['in_progress'], // reopen
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

// one row of the stats GROUP BY query
export interface StatGroup {
  status: TaskStatus;
  priority: TaskPriority;
  count: number;
  overdue: number;
}

// all keys start at 0 so the response always has every status/priority
export function buildStats(groups: readonly StatGroup[]): TaskStats {
  const stats: TaskStats = {
    total: 0,
    overdue: 0,
    byStatus: { todo: 0, in_progress: 0, done: 0 },
    byPriority: { low: 0, medium: 0, high: 0 },
  };

  for (const group of groups) {
    stats.total += group.count;
    stats.overdue += group.overdue;
    stats.byStatus[group.status] += group.count;
    stats.byPriority[group.priority] += group.count;
  }

  return stats;
}
