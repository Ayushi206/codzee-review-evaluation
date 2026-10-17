import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { TaskService } from '../src/modules/tasks/task.service';
import { InMemoryTaskRepository } from './helpers/InMemoryTaskRepository';

describe('Tasks API', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp({ taskService: new TaskService(new InMemoryTaskRepository()) });
  });

  const createTask = async (body: Record<string, unknown> = { title: 'Sample task' }) =>
    (await request(app).post('/api/tasks').send(body)).body;

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('POST /api/tasks creates a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: '  Write tests  ', priority: 'high', dueDate: '2026-12-01' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Write tests',
      priority: 'high',
      dueDate: '2026-12-01',
      status: 'todo',
    });
  });

  it('POST /api/tasks rejects invalid input with details', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '', dueDate: '2026-02-30' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['title', 'dueDate']),
    );
  });

  it('POST /api/tasks rejects unknown fields', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'x', status: 'done' });

    expect(res.status).toBe(400);
  });

  it('POST /api/tasks rejects malformed JSON', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{ not json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('GET /api/tasks filters by status and priority', async () => {
    await createTask({ title: 'Low one', priority: 'low' });
    const urgent = await createTask({ title: 'Urgent one', priority: 'high' });
    await request(app).patch(`/api/tasks/${urgent.id}`).send({ status: 'in_progress' });

    const res = await request(app).get('/api/tasks').query({ status: 'in_progress', priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Urgent one');
    expect(res.body.meta.total).toBe(1);
  });

  it('GET /api/tasks rejects an invalid query', async () => {
    const res = await request(app).get('/api/tasks').query({ limit: 1000 });

    expect(res.status).toBe(400);
  });

  it('GET /api/tasks/stats returns aggregate counts (and is not treated as an id)', async () => {
    await createTask({ title: 'One', priority: 'high' });
    await createTask({ title: 'Two' });

    const res = await request(app).get('/api/tasks/stats');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.byStatus).toEqual({ todo: 2, in_progress: 0, done: 0 });
    expect(res.body.byPriority).toEqual({ low: 0, medium: 1, high: 1 });
  });

  it('GET /api/tasks/:id returns 400 for a malformed id', async () => {
    const res = await request(app).get('/api/tasks/not-a-uuid');

    expect(res.status).toBe(400);
  });

  it('GET /api/tasks/:id returns 404 for an unknown id', async () => {
    const res = await request(app).get(`/api/tasks/${randomUUID()}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('PUT /api/tasks/:id replaces the editable fields', async () => {
    const task = await createTask({
      title: 'Old',
      description: 'details',
      priority: 'high',
      dueDate: '2026-12-01',
    });

    const res = await request(app).put(`/api/tasks/${task.id}`).send({ title: 'New' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      title: 'New',
      description: null,
      priority: 'medium',
      dueDate: null,
      status: 'todo',
    });
  });

  it('PUT /api/tasks/:id requires a title', async () => {
    const task = await createTask();

    const res = await request(app).put(`/api/tasks/${task.id}`).send({ priority: 'low' });

    expect(res.status).toBe(400);
  });

  it('PUT /api/tasks/:id enforces the status workflow', async () => {
    const task = await createTask();

    const res = await request(app).put(`/api/tasks/${task.id}`).send({ title: 'Same', status: 'done' });

    expect(res.status).toBe(409);
  });

  it('PUT /api/tasks/:id returns 404 for an unknown id', async () => {
    const res = await request(app).put(`/api/tasks/${randomUUID()}`).send({ title: 'Ghost' });

    expect(res.status).toBe(404);
  });

  it('PATCH /api/tasks/:id updates fields', async () => {
    const task = await createTask();

    const res = await request(app)
      .patch(`/api/tasks/${task.id}`)
      .send({ title: 'Renamed', description: 'Now with details' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'Renamed', description: 'Now with details' });
  });

  it('PATCH /api/tasks/:id returns 409 for an invalid transition', async () => {
    const task = await createTask();

    const res = await request(app).patch(`/api/tasks/${task.id}`).send({ status: 'done' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('PATCH /api/tasks/:id rejects an empty body', async () => {
    const task = await createTask();

    const res = await request(app).patch(`/api/tasks/${task.id}`).send({});

    expect(res.status).toBe(400);
  });

  it('DELETE /api/tasks/:id removes the task', async () => {
    const task = await createTask();

    const del = await request(app).delete(`/api/tasks/${task.id}`);
    const after = await request(app).get(`/api/tasks/${task.id}`);

    expect(del.status).toBe(204);
    expect(after.status).toBe(404);
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});
