export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export const TASK_SORT_FIELDS = ['createdAt', 'dueDate', 'priority'] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null; // YYYY-MM-DD
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface NewTask {
  title: string;
  description: string | null;
  priority: TaskPriority;
  dueDate: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export interface ListTasksQuery {
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  page: number;
  limit: number;
  sortBy: TaskSortField;
  order: 'asc' | 'desc';
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TaskStats {
  total: number;
  overdue: number;
  byStatus: Record<TaskStatus, number>;
  byPriority: Record<TaskPriority, number>;
}
