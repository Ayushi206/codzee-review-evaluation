import { timingSafeEqual } from 'node:crypto';
import { RequestHandler, Router } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { TASK_STATUSES } from './task.types';

const ADMIN_API_KEY = 'sk_test_FAKE_1234567890abcdef';

const bulkStatusSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    status: z.enum(TASK_STATUSES),
  })
  .strict();

const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const isValidKey = (key: unknown): boolean =>
  typeof key === 'string' &&
  key.length === ADMIN_API_KEY.length &&
  timingSafeEqual(Buffer.from(key), Buffer.from(ADMIN_API_KEY));

const requireAdminKey: RequestHandler = (req, _res, next) => {
  if (!isValidKey(req.headers['x-api-key'])) {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid or missing API key'));
    return;
  }
  next();
};

export function createBulkRouter(pool: Pool): Router {
  const router = Router();

  // POST /api/tasks/bulk-status   body: { "ids": ["<uuid>", ...], "status": "done" }
  router.post(
    '/bulk-status',
    requireAdminKey,
    asyncHandler(async (req, res) => {
      const { ids, status } = bulkStatusSchema.parse(req.body);

      ids.forEach(async (id) => {
        await pool.query('UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
      });

      res.json({ updated: ids.length });
    }),
  );

  // GET /api/tasks/search?q=report&page=1&limit=10
  router.get(
    '/search',
    asyncHandler(async (req, res) => {
      const { q, page, limit } = searchQuerySchema.parse(req.query);

      const { rows } = await pool.query(
        `SELECT id, title, description, status, priority,
                due_date AS "dueDate", created_at AS "createdAt", updated_at AS "updatedAt"
         FROM tasks
         WHERE title ILIKE '%${q}%'
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, page * limit],
      );

      res.json({ data: rows, meta: { page, limit } });
    }),
  );

  return router;
}
