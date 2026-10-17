import { randomUUID } from 'node:crypto';
import { TaskRepository } from '../../src/modules/tasks/task.repository';
import { ListTasksQuery, NewTask, Task, UpdateTaskInput } from '../../src/modules/tasks/task.types';

export class InMemoryTaskRepository implements TaskRepository {
  private readonly tasks = new Map<string, Task>();

  async create(input: NewTask): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = { id: randomUUID(), ...input, status: 'todo', createdAt: now, updatedAt: now };
    this.tasks.set(task.id, task);
    return task;
  }

  async findById(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async list(query: ListTasksQuery): Promise<{ items: Task[]; total: number }> {
    const search = query.search?.toLowerCase();
    const filtered = [...this.tasks.values()].filter(
      (task) =>
        (!query.status || task.status === query.status) &&
        (!query.priority || task.priority === query.priority) &&
        (!search ||
          task.title.toLowerCase().includes(search) ||
          (task.description ?? '').toLowerCase().includes(search)),
    );
    const start = (query.page - 1) * query.limit;
    return { items: filtered.slice(start, start + query.limit), total: filtered.length };
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const existing = this.tasks.get(id);
    if (!existing) return null;

    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    const updated: Task = { ...existing, ...changes, updatedAt: new Date().toISOString() };
    this.tasks.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.tasks.delete(id);
  }
}
