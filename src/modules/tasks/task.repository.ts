import { Pool } from 'pg';
import { buildStats, StatGroup } from './task.domain';
import {
  ListTasksQuery,
  NewTask,
  Task,
  TaskPriority,
  TaskStats,
  TaskStatus,
  UpdateTaskInput,
} from './task.types';

export interface TaskRepository {
  create(input: NewTask): Promise<Task>;
  findById(id: string): Promise<Task | null>;
  list(query: ListTasksQuery): Promise<{ items: Task[]; total: number }>;
  update(id: string, input: UpdateTaskInput): Promise<Task | null>;
  delete(id: string): Promise<boolean>;
  // today is YYYY-MM-DD, used for the overdue count
  getStats(today: string): Promise<TaskStats>;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: Date;
  updated_at: Date;
}

const toTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  dueDate: row.due_date,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

// column names only come from these maps, values always go as $n params
const UPDATABLE_COLUMNS = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  dueDate: 'due_date',
} as const;

const SORT_EXPRESSIONS: Record<ListTasksQuery['sortBy'], string> = {
  createdAt: 'created_at',
  dueDate: 'due_date',
  priority: `CASE priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END`,
};

// escape % and _ for ILIKE
const escapeLike = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

export class PgTaskRepository implements TaskRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: NewTask): Promise<Task> {
    const { rows } = await this.pool.query<TaskRow>(
      `INSERT INTO tasks (title, description, priority, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.title, input.description, input.priority, input.dueDate],
    );
    return toTask(rows[0]);
  }

  async findById(id: string): Promise<Task | null> {
    const { rows } = await this.pool.query<TaskRow>('SELECT * FROM tasks WHERE id = $1', [id]);
    return rows[0] ? toTask(rows[0]) : null;
  }

  async list(query: ListTasksQuery): Promise<{ items: Task[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const addCondition = (build: (index: number) => string, value: unknown): void => {
      params.push(value);
      conditions.push(build(params.length));
    };

    if (query.status) addCondition((i) => `status = $${i}`, query.status);
    if (query.priority) addCondition((i) => `priority = $${i}`, query.priority);
    if (query.search) {
      addCondition(
        (i) => `(title ILIKE $${i} OR description ILIKE $${i})`,
        `%${escapeLike(query.search as string)}%`,
      );
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const direction = query.order === 'asc' ? 'ASC' : 'DESC';
    const offset = (query.page - 1) * query.limit;

    const [countResult, listResult] = await Promise.all([
      this.pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM tasks ${where}`, params),
      this.pool.query<TaskRow>(
        `SELECT * FROM tasks ${where}
         ORDER BY ${SORT_EXPRESSIONS[query.sortBy]} ${direction} NULLS LAST, id
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, query.limit, offset],
      ),
    ]);

    return { items: listResult.rows.map(toTask), total: countResult.rows[0].total };
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const sets: string[] = [];
    const params: unknown[] = [];

    for (const key of Object.keys(UPDATABLE_COLUMNS) as Array<keyof typeof UPDATABLE_COLUMNS>) {
      const value = input[key];
      if (value === undefined) continue;
      params.push(value);
      sets.push(`${UPDATABLE_COLUMNS[key]} = $${params.length}`);
    }

    if (sets.length === 0) return this.findById(id);

    params.push(id);
    const { rows } = await this.pool.query<TaskRow>(
      `UPDATE tasks SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}
       RETURNING *`,
      params,
    );
    return rows[0] ? toTask(rows[0]) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM tasks WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getStats(today: string): Promise<TaskStats> {
    const { rows } = await this.pool.query<StatGroup>(
      `SELECT status,
              priority,
              COUNT(*)::int AS count,
              COUNT(*) FILTER (WHERE due_date <= $1::date AND status <> 'done')::int AS overdue
       FROM tasks
       GROUP BY status, priority`,
      [today],
    );
    return buildStats(rows);
  }
}
