import { Router } from 'express';
import { z } from 'zod';
import { SprintService } from '../services/sprint-service.js';
import { TaskService } from '../services/task-service.js';
import { createManagedListRouter } from './managed-list-routes.js';

// Validation schemas
const createSprintSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
});

const updateSprintSchema = z.object({
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  isHidden: z.boolean().optional(),
});

// Create service instances
const taskService = new TaskService();
const sprintService = new SprintService(taskService);

// Initialize service
sprintService.init().catch(err => {
  console.error('Failed to initialize SprintService:', err);
});

// Create router using the generic factory
const router = createManagedListRouter(
  sprintService,
  createSprintSchema,
  updateSprintSchema
);

export default router;
