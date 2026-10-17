import { z } from 'zod';
import { TASK_PRIORITIES, TASK_SORT_FIELDS, TASK_STATUSES } from './task.types';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'must be a valid calendar date');

const title = z.string().trim().min(1, 'title is required').max(200);
const description = z.string().trim().max(2000);

export const createTaskSchema = z
  .object({
    title,
    description: description.nullish(),
    priority: z.enum(TASK_PRIORITIES).default('medium'),
    dueDate: dateString.nullish(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description: description.nullable().optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    dueDate: dateString.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided',
  });

export const listTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(TASK_SORT_FIELDS).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const taskIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});
