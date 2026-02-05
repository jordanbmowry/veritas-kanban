/**
 * Supabase PostgreSQL Storage Provider
 *
 * Implements the StorageProvider interface using Supabase PostgreSQL backend.
 * Replaces file-based storage with persistent database tables.
 */

import { nanoid } from 'nanoid';
import type {
  Task,
  FeatureSettings,
  TaskTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  ManagedListItem,
  TelemetryEvent,
  TelemetryEventType,
  TelemetryConfig,
  TelemetryQueryOptions,
  AnyTelemetryEvent,
} from '@veritas-kanban/shared';
import type {
  TaskRepository,
  SettingsRepository,
  StorageProvider,
  ActivityRepository,
  TemplateRepository,
  StatusHistoryRepository,
  ManagedListRepository,
  ManagedListProvider,
  TelemetryRepository,
} from './interfaces.js';
import type { Activity, ActivityType } from '../services/activity-service.js';
import type {
  StatusHistoryEntry,
  DailySummary,
  AgentStatusState,
} from '../services/status-history-service.js';
import type { ManagedListServiceConfig } from '../services/managed-list-service.js';
import { supabase } from '../config/supabase.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('supabase-storage');

// ============================================================================
// Task Repository
// ============================================================================

class SupabaseTaskRepository implements TaskRepository {
  async findAll(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .is('archived_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(this.rowToTask);
  }

  async findById(id: string): Promise<Task | null> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .is('archived_at', null)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found
    return data ? this.rowToTask(data) : null;
  }

  async create(task: Task): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .insert([this.taskToRow(task)])
      .select()
      .single();

    if (error) throw error;
    return this.rowToTask(data);
  }

  async update(id: string, updates: Partial<Task>): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...this.taskToRow(updates),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error(`Task ${id} not found`);
    return this.rowToTask(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
  }

  async search(query: string): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .is('archived_at', null)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.rowToTask);
  }

  private rowToTask(row: any): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description || '',
      status: row.status || 'todo',
      type: row.type || 'task',
      priority: row.priority,
      sprint: row.sprint_id,
      project: row.project_id,
      created: row.created_at,
      updated: row.updated_at,
      ...row.metadata,
    } as Task;
  }

  private taskToRow(task: any): Record<string, any> {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      type: task.type,
      priority: task.priority,
      sprint_id: task.sprint,
      project_id: task.project,
      metadata: {},
    };
  }
}

// ============================================================================
// Settings Repository
// ============================================================================

class SupabaseSettingsRepository implements SettingsRepository {
  async get(): Promise<FeatureSettings> {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'feature_settings')
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data?.value || {};
  }

  async update(settings: Partial<FeatureSettings>): Promise<FeatureSettings> {
    const current = await this.get();
    const merged = { ...current, ...settings };

    const { data, error } = await supabase
      .from('settings')
      .upsert({ key: 'feature_settings', value: merged, updated_at: new Date().toISOString() })
      .select('value')
      .single();

    if (error) throw error;
    return data.value;
  }
}

// ============================================================================
// Activity Repository
// ============================================================================

class SupabaseActivityRepository implements ActivityRepository {
  async getActivities(limit: number = 50): Promise<Activity[]> {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      taskId: row.task_id,
      taskTitle: row.task_title,
      agent: row.agent,
      details: row.details || {},
      timestamp: row.created_at,
    }));
  }

  async logActivity(
    type: ActivityType,
    taskId: string,
    taskTitle: string,
    details?: Record<string, unknown>,
    agent?: string
  ): Promise<Activity> {
    const activity = {
      id: `activity_${nanoid(12)}`,
      type,
      task_id: taskId,
      task_title: taskTitle,
      details: details || {},
      agent,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('activities').insert([activity]).select().single();

    if (error) throw error;

    return {
      id: data.id,
      type: data.type,
      taskId: data.task_id,
      taskTitle: data.task_title,
      agent: data.agent,
      details: data.details || {},
      timestamp: data.created_at,
    };
  }

  async clearActivities(): Promise<void> {
    const { error } = await supabase.from('activities').delete().neq('id', '');
    if (error) throw error;
  }
}

// ============================================================================
// Template Repository
// ============================================================================

class SupabaseTemplateRepository implements TemplateRepository {
  async getTemplates(): Promise<TaskTemplate[]> {
    const { data, error } = await supabase.from('task_templates').select('*').order('name');

    if (error) throw error;
    return (data || []).map(this.rowToTemplate);
  }

  async getTemplate(id: string): Promise<TaskTemplate | null> {
    const { data, error } = await supabase.from('task_templates').select('*').eq('id', id).single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.rowToTemplate(data) : null;
  }

  async createTemplate(input: CreateTemplateInput): Promise<TaskTemplate> {
    const template = {
      id: `template_${nanoid(12)}`,
      name: input.name,
      description: input.description,
      template_data: input as any,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('task_templates')
      .insert([template])
      .select()
      .single();

    if (error) throw error;
    return this.rowToTemplate(data);
  }

  async updateTemplate(id: string, input: UpdateTemplateInput): Promise<TaskTemplate | null> {
    const { data, error } = await supabase
      .from('task_templates')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.rowToTemplate(data) : null;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const { error } = await supabase.from('task_templates').delete().eq('id', id);
    if (error && error.code !== 'PGRST116') throw error;
    return !error || error.code === 'PGRST116';
  }

  private rowToTemplate(row: any): TaskTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      ...row.template_data,
    } as TaskTemplate;
  }
}

// ============================================================================
// Status History Repository
// ============================================================================

class SupabaseStatusHistoryRepository implements StatusHistoryRepository {
  async getHistory(limit: number = 100, offset: number = 0): Promise<StatusHistoryEntry[]> {
    const { data, error } = await supabase
      .from('status_history')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      timestamp: row.created_at,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      taskId: row.task_id,
      taskTitle: row.task_title,
      subAgentCount: row.sub_agent_count,
    }));
  }

  async logStatusChange(
    previousStatus: AgentStatusState,
    newStatus: AgentStatusState,
    taskId?: string,
    taskTitle?: string,
    subAgentCount?: number
  ): Promise<StatusHistoryEntry> {
    const entry = {
      id: `status_${nanoid(12)}`,
      previous_status: previousStatus,
      new_status: newStatus,
      task_id: taskId,
      task_title: taskTitle,
      sub_agent_count: subAgentCount,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('status_history').insert([entry]).select().single();

    if (error) throw error;

    return {
      id: data.id,
      timestamp: data.created_at,
      previousStatus: data.previous_status,
      newStatus: data.new_status,
      taskId: data.task_id,
      taskTitle: data.task_title,
      subAgentCount: data.sub_agent_count,
    };
  }

  async getHistoryByDateRange(startDate: string, endDate: string): Promise<StatusHistoryEntry[]> {
    const { data, error } = await supabase
      .from('status_history')
      .select('*')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      timestamp: row.created_at,
      previousStatus: row.previous_status,
      newStatus: row.new_status,
      taskId: row.task_id,
      taskTitle: row.task_title,
      subAgentCount: row.sub_agent_count,
    }));
  }

  async getDailySummary(date?: string): Promise<DailySummary> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('date', targetDate)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (data) {
      return {
        date: data.date,
        activeMs: data.tasks_created || 0,
        idleMs: data.tasks_completed || 0,
        errorMs: data.tasks_updated || 0,
        transitions: data.agent_status_changes || 0,
        periods: [],
      };
    }

    return {
      date: targetDate,
      activeMs: 0,
      idleMs: 0,
      errorMs: 0,
      transitions: 0,
      periods: [],
    };
  }

  async getWeeklySummary(): Promise<DailySummary[]> {
    const summaries: DailySummary[] = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      summaries.push(await this.getDailySummary(dateStr));
    }

    return summaries;
  }

  async clearHistory(): Promise<void> {
    const { error } = await supabase.from('status_history').delete().neq('id', '');
    if (error) throw error;
  }
}

// ============================================================================
// Managed List Repository
// ============================================================================

class SupabaseManagedListRepository<T extends ManagedListItem> implements ManagedListRepository<T> {
  constructor(private listType: string) {}

  async init(): Promise<void> {
    // No initialization needed for Supabase
  }

  async list(includeHidden: boolean = false): Promise<T[]> {
    let query = supabase.from('managed_lists').select('*').eq('list_type', this.listType);

    if (!includeHidden) {
      query = query.eq('is_hidden', false);
    }

    const { data, error } = await query.order('order');
    if (error) throw error;

    return (data || []).map(this.rowToItem);
  }

  async get(id: string): Promise<T | null> {
    const { data, error } = await supabase
      .from('managed_lists')
      .select('*')
      .eq('id', id)
      .eq('list_type', this.listType)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.rowToItem(data) : null;
  }

  async create(input: Omit<T, 'order' | 'created' | 'updated'> & { id?: string }): Promise<T> {
    const maxOrderResult = await supabase
      .from('managed_lists')
      .select('order')
      .eq('list_type', this.listType)
      .order('order', { ascending: false })
      .limit(1)
      .single();

    const order = (maxOrderResult.data?.order || 0) + 1;

    const item = {
      id: input.id || `${this.listType}_${nanoid(8)}`,
      list_type: this.listType,
      ...input,
      order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('managed_lists').insert([item]).select().single();

    if (error) throw error;
    return this.rowToItem(data);
  }

  async seedItem(item: T): Promise<T> {
    const { data, error } = await supabase
      .from('managed_lists')
      .insert([{ ...item, list_type: this.listType }])
      .select()
      .single();

    if (error) throw error;
    return this.rowToItem(data);
  }

  async update(id: string, patch: Partial<T>): Promise<T | null> {
    const { data, error } = await supabase
      .from('managed_lists')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('list_type', this.listType)
      .select()
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data ? this.rowToItem(data) : null;
  }

  async canDelete(
    id: string
  ): Promise<{ allowed: boolean; referenceCount: number; isDefault: boolean }> {
    const item = await this.get(id);
    return {
      allowed: !item?.isDefault,
      referenceCount: 0,
      isDefault: item?.isDefault || false,
    };
  }

  async delete(
    id: string,
    force: boolean = false
  ): Promise<{ deleted: boolean; referenceCount?: number }> {
    const { error } = await supabase
      .from('managed_lists')
      .delete()
      .eq('id', id)
      .eq('list_type', this.listType);

    if (error && error.code !== 'PGRST116') throw error;
    return { deleted: !error };
  }

  async reorder(orderedIds: string[]): Promise<T[]> {
    const updates = orderedIds.map((id, index) => ({
      id,
      order: index,
      updated_at: new Date().toISOString(),
    }));

    for (const update of updates) {
      const { error } = await supabase.from('managed_lists').update(update).eq('id', update.id);
      if (error) throw error;
    }

    return this.list();
  }

  private rowToItem(row: any): T {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isDefault: row.is_default,
      isHidden: row.is_hidden,
      order: row.order,
      created: row.created_at,
      updated: row.updated_at,
    } as T;
  }
}

// ============================================================================
// Managed List Provider
// ============================================================================

class SupabaseManagedListProvider implements ManagedListProvider {
  create<T extends ManagedListItem>(config: ManagedListServiceConfig<T>): ManagedListRepository<T> {
    return new SupabaseManagedListRepository<T>(config.name);
  }
}

// ============================================================================
// Telemetry Repository
// ============================================================================

class SupabaseTelemetryRepository implements TelemetryRepository {
  private config: TelemetryConfig = { enabled: true, retention: 30, traces: false };

  async init(): Promise<void> {
    // Cleanup old events on init
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.config.retention);

    const { error } = await supabase
      .from('telemetry_events')
      .delete()
      .lt('created_at', retentionDate.toISOString());

    if (error) log.error('Failed to cleanup old telemetry events', error);
  }

  async emit<T extends TelemetryEvent>(event: Omit<T, 'id' | 'timestamp'>): Promise<T> {
    const fullEvent: T = {
      ...event,
      id: `evt_${nanoid(12)}`,
      timestamp: new Date().toISOString(),
    } as T;

    const { error } = await supabase.from('telemetry_events').insert([
      {
        id: fullEvent.id,
        type: fullEvent.type,
        task_id: fullEvent.taskId,
        data: fullEvent,
        created_at: fullEvent.timestamp,
      },
    ]);

    if (error) log.error('Failed to emit telemetry event', error);
    return fullEvent;
  }

  async getEvents(options: TelemetryQueryOptions = {}): Promise<AnyTelemetryEvent[]> {
    const { type, since, until, taskId, limit } = options;

    let query = supabase.from('telemetry_events').select('data');

    if (type) {
      const types = Array.isArray(type) ? type : [type];
      query = query.in('type', types);
    }

    if (since) query = query.gte('created_at', since);
    if (until) query = query.lte('created_at', until);
    if (taskId) query = query.eq('task_id', taskId);

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(limit || 1000);

    if (error) throw error;
    return (data || []).map((row: any) => row.data);
  }

  async getTaskEvents(taskId: string): Promise<AnyTelemetryEvent[]> {
    return this.getEvents({ taskId });
  }

  async getBulkTaskEvents(taskIds: string[]): Promise<Map<string, AnyTelemetryEvent[]>> {
    const result = new Map<string, AnyTelemetryEvent[]>();
    for (const taskId of taskIds) {
      result.set(taskId, await this.getTaskEvents(taskId));
    }
    return result;
  }

  async getEventsSince(since: string): Promise<AnyTelemetryEvent[]> {
    return this.getEvents({ since });
  }

  async countEvents(
    type: TelemetryEventType | TelemetryEventType[],
    since?: string,
    until?: string
  ): Promise<number> {
    const events = await this.getEvents({ type, since, until });
    return events.length;
  }

  async clear(): Promise<void> {
    const { error } = await supabase.from('telemetry_events').delete().neq('id', '');
    if (error) throw error;
  }

  async flush(): Promise<void> {
    // Flush is a no-op for Supabase (writes are immediate)
  }

  async exportAsJson(options: TelemetryQueryOptions = {}): Promise<string> {
    const events = await this.getEvents(options);
    return JSON.stringify(events, null, 2);
  }

  async exportAsCsv(options: TelemetryQueryOptions = {}): Promise<string> {
    const events = await this.getEvents(options);
    if (events.length === 0) {
      return 'id,type,timestamp,taskId\n';
    }

    const headers = ['id', 'type', 'timestamp', 'taskId'];
    const rows = events.map((e: any) => [e.id, e.type, e.timestamp, e.taskId || ''].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  configure(config: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

// ============================================================================
// Supabase Storage Provider
// ============================================================================

export class SupabaseStorageProvider implements StorageProvider {
  readonly tasks = new SupabaseTaskRepository();
  readonly settings = new SupabaseSettingsRepository();
  readonly activities = new SupabaseActivityRepository();
  readonly templates = new SupabaseTemplateRepository();
  readonly statusHistory = new SupabaseStatusHistoryRepository();
  readonly managedLists = new SupabaseManagedListProvider();
  readonly telemetry = new SupabaseTelemetryRepository();

  async initialize(): Promise<void> {
    log.info('Initializing Supabase storage provider');
    await this.telemetry.init();
  }

  async shutdown(): Promise<void> {
    log.info('Shutting down Supabase storage provider');
    // Supabase client cleanup
    await supabase.auth.signOut();
  }
}
