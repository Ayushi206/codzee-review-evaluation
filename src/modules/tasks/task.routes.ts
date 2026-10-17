import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createTaskSchema,
  listTasksQuerySchema,
  replaceTaskSchema,
  taskIdParamSchema,
  updateTaskSchema,
} from './task.schema';
import { TaskService } from './task.service';

export function createTaskRouter(service: TaskService): Router {
  const router = Router();

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const input = createTaskSchema.parse(req.body);
      res.status(201).json(await service.create(input));
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const query = listTasksQuerySchema.parse(req.query);
      res.json(await service.list(query));
    }),
  );

  // keep above /:id, otherwise "stats" is parsed as an id
  router.get(
    '/stats',
    asyncHandler(async (_req, res) => {
      res.json(await service.getStats());
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = taskIdParamSchema.parse(req.params);
      res.json(await service.getById(id));
    }),
  );

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = taskIdParamSchema.parse(req.params);
      const input = replaceTaskSchema.parse(req.body);
      res.json(await service.replace(id, input));
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = taskIdParamSchema.parse(req.params);
      const input = updateTaskSchema.parse(req.body);
      res.json(await service.update(id, input));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const { id } = taskIdParamSchema.parse(req.params);
      await service.delete(id);
      res.status(204).send();
    }),
  );

  return router;
}
