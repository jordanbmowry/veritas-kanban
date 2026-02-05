/**
 * Task Service Interface
 *
 * Common interface for both file-based TaskService and storage-based adapter.
 * This allows the app to work with either backend transparently.
 */

import type { Task, CreateTaskInput, UpdateTaskInput } from '@veritas-kanban/shared';

export interface ITaskService {
  // Core CRUD operations
  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | null>;
  createTask(input: CreateTaskInput): Promise<Task>;
  updateTask(id: string, input: UpdateTaskInput): Promise<Task | null>;
  deleteTask(id: string): Promise<boolean>;

  // Search
  searchTasks(query: string): Promise<Task[]>;

  // Dependencies
  getTasksWithDependencies(taskIds?: string[]): Promise<Task[]>;

  // Archive operations
  archiveTask(id: string): Promise<boolean>;
  listArchivedTasks(): Promise<Task[]>;
  getArchivedTask(id: string): Promise<Task | null>;
  restoreTask(id: string): Promise<Task | null>;
  getArchiveSuggestions(): Promise<{ sprint: string; taskCount: number; tasks: Task[] }[]>;
  archiveSprint(sprint: string): Promise<{ archived: number; taskIds: string[] }>;

  // Time tracking
  startTimer(taskId: string): Promise<Task>;
  stopTimer(taskId: string): Promise<Task>;
  addTimeEntry(taskId: string, duration: number, description?: string): Promise<Task>;
  deleteTimeEntry(taskId: string, entryId: string): Promise<Task>;
  getTimeSummary(): Promise<{
    totalTasks: number;
    tasksWithTime: number;
    totalSeconds: number;
    byProject: Record<string, number>;
    bySprint: Record<string, number>;
  }>;

  // Reordering
  reorderTasks(orderedIds: string[]): Promise<Task[]>;

  // Lifecycle
  dispose(): void;
}
