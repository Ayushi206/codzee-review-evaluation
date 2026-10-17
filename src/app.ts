import express, { Express, Router } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { createTaskRouter } from './modules/tasks/task.routes';
import { TaskService } from './modules/tasks/task.service';

export interface AppDependencies {
  taskService: TaskService;
  bulkRouter?: Router;
}

// service is passed in so tests can use the in-memory repo
export function createApp({ taskService, bulkRouter }: AppDependencies): Express {
  const app = express();

  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (bulkRouter) {
    app.use('/api/tasks', bulkRouter);
  }
  app.use('/api/tasks', createTaskRouter(taskService));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
