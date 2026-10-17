import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { canTransition } from '../src/modules/tasks/task.domain';
import { TaskService } from '../src/modules/tasks/task.service';
import { ListTasksQuery } from '../src/modules/tasks/task.types';
import { InMemoryTaskRepository } from './helpers/InMemoryTaskRepository';

const defaultQuery: ListTasksQuery = { page: 1, limit: 20, sortBy: 'createdAt', order: 'desc' };

describe('canTransition', () => {
  it.each([
    ['todo', 'in_progress', true],
    ['in_progress', 'done', true],
    ['in_progress', 'todo', true],
    ['done', 'in_progress', true],
    ['todo', 'done', false],
    ['done', 'todo', false],
    ['todo', 'todo', true],
  ] as const)('%s -> %s is %s', (from, to, expected) => {
    expect(canTransition(from, to)).toBe(expected);
  });
});

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(() => {
    service = new TaskService(new InMemoryTaskRepository());
  });

  it('creates a task with sensible defaults', async () => {
    const task = await service.create({ title: 'Write docs' });

    expect(task).toMatchObject({
      title: 'Write docs',
      description: null,
      dueDate: null,
      status: 'todo',
      priority: 'medium',
    });
  });

  it('throws NOT_FOUND for an unknown task', async () => {
    await expect(service.getById(randomUUID())).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('allows a valid status transition', async () => {
    const task = await service.create({ title: 'Ship it' });
    const updated = await service.update(task.id, { status: 'in_progress' });

    expect(updated.status).toBe('in_progress');
  });

  it('rejects an invalid status transition with 409', async () => {
    const task = await service.create({ title: 'Ship it' });

    await expect(service.update(task.id, { status: 'done' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_STATUS_TRANSITION',
    });
  });

  it('lets a completed task be reopened', async () => {
    const task = await service.create({ title: 'Fix bug' });
    await service.update(task.id, { status: 'in_progress' });
    await service.update(task.id, { status: 'done' });

    const reopened = await service.update(task.id, { status: 'in_progress' });
    expect(reopened.status).toBe('in_progress');
  });

  it('returns pagination metadata', async () => {
    for (const title of ['A', 'B', 'C']) await service.create({ title });

    const result = await service.list({ ...defaultQuery, limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });

  it('throws NOT_FOUND when deleting an unknown task', async () => {
    await expect(service.delete(randomUUID())).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('TaskService.getStats', () => {
  const fixedNow = () => new Date('2026-10-17T10:00:00Z');

  it('returns zeros when there are no tasks', async () => {
    const service = new TaskService(new InMemoryTaskRepository(), fixedNow);

    expect(await service.getStats()).toEqual({
      total: 0,
      overdue: 0,
      byStatus: { todo: 0, in_progress: 0, done: 0 },
      byPriority: { low: 0, medium: 0, high: 0 },
    });
  });

  it('counts by status and priority and only flags unfinished, past-due tasks as overdue', async () => {
    const service = new TaskService(new InMemoryTaskRepository(), fixedNow);

    await service.create({ title: 'Late', priority: 'high', dueDate: '2026-10-01' });
    await service.create({ title: 'Due today', dueDate: '2026-10-17' });
    await service.create({ title: 'No due date' });
    const finished = await service.create({ title: 'Finished late', dueDate: '2026-09-01' });
    await service.update(finished.id, { status: 'in_progress' });
    await service.update(finished.id, { status: 'done' });

    expect(await service.getStats()).toEqual({
      total: 4,
      overdue: 1,
      byStatus: { todo: 3, in_progress: 0, done: 1 },
      byPriority: { low: 0, medium: 3, high: 1 },
    });
  });
});
