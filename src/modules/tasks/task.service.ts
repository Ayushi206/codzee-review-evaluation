import { AppError, notFound } from '../../utils/AppError';
import { canTransition } from './task.domain';
import { TaskRepository } from './task.repository';
import {
  ListTasksQuery,
  NewTask,
  Paginated,
  Task,
  TaskStats,
  TaskStatus,
  UpdateTaskInput,
} from './task.types';

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: NewTask['priority'];
  dueDate?: string | null;
}

export interface ReplaceTaskInput extends CreateTaskInput {
  status?: TaskStatus;
}

export class TaskService {
  // now() can be swapped in tests
  constructor(
    private readonly repository: TaskRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  create(input: CreateTaskInput): Promise<Task> {
    return this.repository.create({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate ?? null,
    });
  }

  async list(query: ListTasksQuery): Promise<Paginated<Task>> {
    const { items, total } = await this.repository.list(query);
    return {
      data: items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getById(id: string): Promise<Task> {
    const task = await this.repository.findById(id);
    if (!task) throw notFound('Task');
    return task;
  }

  update(id: string, input: UpdateTaskInput): Promise<Task> {
    return this.applyChanges(id, input);
  }

  // PUT: missing optional fields go back to defaults, status only changes if sent
  replace(id: string, input: ReplaceTaskInput): Promise<Task> {
    return this.applyChanges(id, {
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate ?? null,
      ...(input.status ? { status: input.status } : {}),
    });
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw notFound('Task');
  }

  getStats(): Promise<TaskStats> {
    // UTC date
    const today = this.now().toISOString().slice(0, 10);
    return this.repository.getStats(today);
  }

  // used by both PATCH and PUT
  private async applyChanges(id: string, changes: UpdateTaskInput): Promise<Task> {
    const existing = await this.getById(id);

    if (changes.status && !canTransition(existing.status, changes.status)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot move a task from "${existing.status}" to "${changes.status}"`,
      );
    }

    const updated = await this.repository.update(id, changes);
    if (!updated) throw notFound('Task'); // deleted between the read and the write
    return updated;
  }
}
