import { z } from 'zod';
import { TASK_PRIORITIES, TASK_SORT_FIELDS, TASK_STATUSES } from './task.types';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be in YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'must be a valid calendar date');

// shared field rules for create / put / patch
const fields = {
  title: z.string().trim().min(1, 'title is required').max(255),
  description: z.string().trim().max(2000),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  dueDate: dateString,
};

const createShape = {
  title: fields.title,
  description: fields.description.nullish(),
  priority: fields.priority.default('medium'),
  dueDate: fields.dueDate.nullish(),
};

export const createTaskSchema = z.object(createShape).strict();

// PUT = create fields + optional status
export const replaceTaskSchema = z
  .object({ ...createShape, status: fields.status.optional() })
  .strict();

export const updateTaskSchema = z
  .object({
    title: fields.title.optional(),
    description: fields.description.optional(),
    status: fields.status.optional(),
    priority: fields.priority.optional(),
    dueDate: fields.dueDate.nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided',
  });

export const listTasksQuerySchema = z.object({
  status: fields.status.optional(),
  priority: fields.priority.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(TASK_SORT_FIELDS).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const taskIdParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});
