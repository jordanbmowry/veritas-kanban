/**
 * Storage Task Adapter
 *
 * Provides a TaskService-compatible interface that delegates to the storage layer.
 * This allows the app to use Supabase (or any storage backend) while maintaining
 * the existing TaskService API.
 */

import { nanoid } from 'nanoid';
import type { Task, CreateTaskInput, UpdateTaskInput } from '@veritas-kanban/shared';
import { getStorage } from '../storage/index.js';
import { getTelemetryService } from './telemetry-service.js';
import { createLogger } from '../lib/logger.js';
import type { ITaskService } from './task-service-interface.js';

const log = createLogger('storage-task-adapter');

/**
 * Adapter class that implements the TaskService interface using the storage layer
 */
export class StorageTaskAdapter implements ITaskService {
  private telemetry = getTelemetryService();

  /**
   * Generate a unique task ID
   */
  private generateId(): string {
    return `task_${nanoid(12)}`;
  }

  /**
   * List all non-archived tasks
   */
  async listTasks(): Promise<Task[]> {
    const storage = getStorage();
    const tasks = await storage.tasks.findAll();
    log.debug({ count: tasks.length }, 'Listed tasks from storage');
    return tasks;
  }

  /**
   * Get tasks with their dependencies resolved
   * For now, just filters by taskIds if provided
   */
  async getTasksWithDependencies(taskIds?: string[]): Promise<Task[]> {
    const tasks = await this.listTasks();
    if (!taskIds || taskIds.length === 0) {
      return tasks;
    }
    return tasks.filter((t) => taskIds.includes(t.id));
  }

  /**
   * Get a single task by ID
   */
  async getTask(id: string): Promise<Task | null> {
    const storage = getStorage();
    return await storage.tasks.findById(id);
  }

  /**
   * Create a new task
   */
  async createTask(input: CreateTaskInput): Promise<Task> {
    const storage = getStorage();
    const now = new Date().toISOString();

    const task: Task = {
      id: this.generateId(),
      title: input.title,
      description: input.description || '',
      type: input.type || 'code',
      status: 'todo',
      priority: input.priority || 'medium',
      project: input.project,
      sprint: input.sprint,
      agent: input.agent,
      subtasks: input.subtasks,
      blockedBy: input.blockedBy,
      created: now,
      updated: now,
    };

    const createdTask = await storage.tasks.create(task);

    // Emit telemetry event
    try {
      await this.telemetry.emit({
        type: 'task.created',
        taskId: createdTask.id,
      });
    } catch (err) {
      log.warn({ err }, 'Failed to emit telemetry');
    }

    log.info({ taskId: createdTask.id, title: createdTask.title }, 'Task created in storage');
    return createdTask;
  }

  /**
   * Update an existing task
   */
  async updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const storage = getStorage();

    // Check if task exists
    const existing = await storage.tasks.findById(id);
    if (!existing) {
      log.warn({ taskId: id }, 'Task not found for update');
      return null;
    }

    const updates: Partial<Task> = {
      ...(input as Partial<Task>),
      updated: new Date().toISOString(),
    };

    const updatedTask = await storage.tasks.update(id, updates);

    log.info({ taskId: id, fields: Object.keys(input) }, 'Task updated in storage');
    return updatedTask;
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<boolean> {
    const storage = getStorage();

    try {
      await storage.tasks.delete(id);
      log.info({ taskId: id }, 'Task deleted from storage');
      return true;
    } catch (error) {
      log.error({ err: error, taskId: id }, 'Failed to delete task');
      return false;
    }
  }

  /**
   * Search tasks by query string
   */
  async searchTasks(query: string): Promise<Task[]> {
    const storage = getStorage();
    return await storage.tasks.search(query);
  }

  // ==================== ARCHIVE METHODS ====================
  // Note: The storage layer doesn't have built-in archive support yet
  // These methods use simple workarounds for now

  /**
   * Archive a task (soft delete by setting status to done and filtering)
   * TODO: Add proper archived_at field to storage layer
   */
  async archiveTask(id: string): Promise<boolean> {
    log.warn({ taskId: id }, 'Archive not yet fully implemented - deleting task instead');
    return this.deleteTask(id);
  }

  /**
   * List archived tasks
   * TODO: Implement when storage layer supports archived_at
   */
  async listArchivedTasks(): Promise<Task[]> {
    log.debug('listArchivedTasks called - not yet implemented');
    return [];
  }

  /**
   * Get an archived task by ID
   * TODO: Implement when storage layer supports archived_at
   */
  async getArchivedTask(id: string): Promise<Task | null> {
    log.debug({ taskId: id }, 'getArchivedTask called - not yet implemented');
    return null;
  }

  /**
   * Restore an archived task
   * TODO: Implement when storage layer supports archived_at
   */
  async restoreTask(id: string): Promise<Task | null> {
    log.debug({ taskId: id }, 'restoreTask called - not yet implemented');
    return null;
  }

  /**
   * Get suggestions for tasks to archive
   */
  async getArchiveSuggestions(): Promise<{ sprint: string; taskCount: number; tasks: Task[] }[]> {
    const tasks = await this.listTasks();
    const completedTasks = tasks.filter((t) => t.status === 'done');

    // Group by sprint
    const bySprint = new Map<string, Task[]>();
    for (const task of completedTasks) {
      if (!task.sprint) continue;
      if (!bySprint.has(task.sprint)) {
        bySprint.set(task.sprint, []);
      }
      bySprint.get(task.sprint)!.push(task);
    }

    return Array.from(bySprint.entries()).map(([sprint, tasks]) => ({
      sprint,
      taskCount: tasks.length,
      tasks,
    }));
  }

  /**
   * Archive all done tasks in a sprint
   */
  async archiveSprint(sprint: string): Promise<{ archived: number; taskIds: string[] }> {
    const tasks = await this.listTasks();
    const sprintTasks = tasks.filter((t) => t.sprint === sprint && t.status === 'done');

    const archived: string[] = [];
    for (const task of sprintTasks) {
      const success = await this.archiveTask(task.id);
      if (success) {
        archived.push(task.id);
      }
    }

    return { archived: archived.length, taskIds: archived };
  }

  // ==================== TIME TRACKING METHODS ====================
  // Note: Time tracking uses the timeTracking field in Task

  /**
   * Start a timer for a task
   */
  async startTimer(taskId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const now = new Date().toISOString();
    const entryId = nanoid(8);

    const timeTracking = task.timeTracking || {
      entries: [],
      totalSeconds: 0,
      isRunning: false,
    };

    timeTracking.entries.push({
      id: entryId,
      startTime: now,
      manual: false,
    });
    timeTracking.isRunning = true;
    timeTracking.activeEntryId = entryId;

    const updated = await this.updateTask(taskId, { timeTracking });
    if (!updated) {
      throw new Error(`Failed to start timer for task ${taskId}`);
    }

    return updated;
  }

  /**
   * Stop the active timer for a task
   */
  async stopTimer(taskId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task || !task.timeTracking?.isRunning) {
      throw new Error(`No active timer for task ${taskId}`);
    }

    const now = new Date().toISOString();
    const timeTracking = task.timeTracking;
    const activeEntry = timeTracking.entries.find((e) => e.id === timeTracking.activeEntryId);

    if (!activeEntry) {
      throw new Error(`Active timer entry not found for task ${taskId}`);
    }

    const start = new Date(activeEntry.startTime).getTime();
    const end = Date.now();
    const duration = Math.floor((end - start) / 1000);

    activeEntry.endTime = now;
    activeEntry.duration = duration;
    timeTracking.totalSeconds = (timeTracking.totalSeconds || 0) + duration;
    timeTracking.isRunning = false;
    timeTracking.activeEntryId = undefined;

    const updated = await this.updateTask(taskId, { timeTracking });
    if (!updated) {
      throw new Error(`Failed to stop timer for task ${taskId}`);
    }

    return updated;
  }

  /**
   * Add a manual time entry
   */
  async addTimeEntry(taskId: string, duration: number, description?: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const now = new Date().toISOString();
    const timeTracking = task.timeTracking || {
      entries: [],
      totalSeconds: 0,
      isRunning: false,
    };

    timeTracking.entries.push({
      id: nanoid(8),
      startTime: now,
      endTime: now,
      duration,
      description,
      manual: true,
    });
    timeTracking.totalSeconds = (timeTracking.totalSeconds || 0) + duration;

    const updated = await this.updateTask(taskId, { timeTracking });
    if (!updated) {
      throw new Error(`Failed to add time entry for task ${taskId}`);
    }

    return updated;
  }

  /**
   * Delete a time entry
   */
  async deleteTimeEntry(taskId: string, entryId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task || !task.timeTracking) {
      throw new Error(`Task ${taskId} not found or has no time tracking`);
    }

    const timeTracking = task.timeTracking;
    const entry = timeTracking.entries.find((e) => e.id === entryId);

    if (!entry) {
      throw new Error(`Time entry ${entryId} not found`);
    }

    // Remove the entry and update total
    timeTracking.entries = timeTracking.entries.filter((e) => e.id !== entryId);
    if (entry.duration) {
      timeTracking.totalSeconds = Math.max(0, timeTracking.totalSeconds - entry.duration);
    }

    const updated = await this.updateTask(taskId, { timeTracking });
    if (!updated) {
      throw new Error(`Failed to delete time entry for task ${taskId}`);
    }

    return updated;
  }

  /**
   * Reorder tasks by updating their position
   */
  async reorderTasks(orderedIds: string[]): Promise<Task[]> {
    const tasks: Task[] = [];

    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const task = await this.updateTask(id, { position: i });
      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Get time tracking summary across all tasks
   */
  async getTimeSummary(): Promise<{
    totalTasks: number;
    tasksWithTime: number;
    totalSeconds: number;
    byProject: Record<string, number>;
    bySprint: Record<string, number>;
  }> {
    const tasks = await this.listTasks();

    let totalSeconds = 0;
    let tasksWithTime = 0;
    const byProject: Record<string, number> = {};
    const bySprint: Record<string, number> = {};

    for (const task of tasks) {
      if (!task.timeTracking || task.timeTracking.totalSeconds === 0) continue;

      tasksWithTime++;
      const taskTotal = task.timeTracking.totalSeconds;
      totalSeconds += taskTotal;

      if (task.project) {
        byProject[task.project] = (byProject[task.project] || 0) + taskTotal;
      }
      if (task.sprint) {
        bySprint[task.sprint] = (bySprint[task.sprint] || 0) + taskTotal;
      }
    }

    return {
      totalTasks: tasks.length,
      tasksWithTime,
      totalSeconds,
      byProject,
      bySprint,
    };
  }

  /**
   * Dispose - no-op for storage adapter
   */
  dispose(): void {
    log.info('Storage task adapter disposed');
  }
}
