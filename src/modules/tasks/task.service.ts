import { AppError, notFound } from '../../utils/AppError';
import { canTransition } from './task.domain';
import { TaskRepository } from './task.repository';
import { ListTasksQuery, NewTask, Paginated, Task, UpdateTaskInput } from './task.types';

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: NewTask['priority'];
  dueDate?: string | null;
}

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

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

  async update(id: string, input: UpdateTaskInput): Promise<Task> {
    const existing = await this.getById(id);

    if (input.status && !canTransition(existing.status, input.status)) {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        `Cannot move a task from "${existing.status}" to "${input.status}"`,
      );
    }

    const updated = await this.repository.update(id, input);
    if (!updated) throw notFound('Task'); // deleted between the read and the write
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw notFound('Task');
  }
}
