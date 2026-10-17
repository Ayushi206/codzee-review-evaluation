import { createApp } from './app';
import { env } from './config/env';
import { createPool } from './db/pool';
import { PgTaskRepository } from './modules/tasks/task.repository';
import { TaskService } from './modules/tasks/task.service';

const pool = createPool(env.DATABASE_URL);
const app = createApp({ taskService: new TaskService(new PgTaskRepository(pool)) });

const server = app.listen(env.PORT, () => {
  console.log(`Task Manager API listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
