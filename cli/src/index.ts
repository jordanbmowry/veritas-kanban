#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

const API_BASE = process.env.VK_API_URL || 'http://localhost:3001';

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'code' | 'research' | 'content' | 'automation';
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
  project?: string;
  tags?: string[];
  created: string;
  updated: string;
  git?: {
    repo: string;
    branch: string;
    baseBranch: string;
    worktreePath?: string;
  };
  attempt?: {
    id: string;
    agent: string;
    status: string;
    started?: string;
    ended?: string;
  };
  review?: {
    decision?: 'approved' | 'changes-requested' | 'rejected';
    decidedAt?: string;
    summary?: string;
  };
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API error: ${res.status}`);
  }
  
  if (res.status === 204) return undefined as T;
  return res.json();
}

function formatTask(task: Task, verbose = false): string {
  const statusColors: Record<string, (s: string) => string> = {
    'todo': chalk.gray,
    'in-progress': chalk.yellow,
    'review': chalk.blue,
    'done': chalk.green,
  };
  
  const priorityColors: Record<string, (s: string) => string> = {
    'low': chalk.dim,
    'medium': chalk.white,
    'high': chalk.red,
  };
  
  const typeIcons: Record<string, string> = {
    'code': '💻',
    'research': '🔍',
    'content': '📝',
    'automation': '⚡',
  };
  
  const statusColor = statusColors[task.status] || chalk.white;
  const priorityColor = priorityColors[task.priority] || chalk.white;
  
  let line = `${typeIcons[task.type] || '•'} ${chalk.cyan(task.id.slice(-8))} `;
  line += statusColor(`[${task.status}]`) + ' ';
  line += priorityColor(`(${task.priority})`) + ' ';
  line += chalk.bold(task.title);
  
  if (task.project) {
    line += chalk.dim(` #${task.project}`);
  }
  
  if (verbose) {
    line += '\n';
    if (task.description) {
      line += chalk.dim(`   ${task.description.slice(0, 80)}${task.description.length > 80 ? '...' : ''}\n`);
    }
    if (task.git?.branch) {
      line += chalk.dim(`   🌿 ${task.git.branch}\n`);
    }
    if (task.attempt?.status === 'running') {
      line += chalk.yellow(`   🤖 Agent running (${task.attempt.agent})\n`);
    }
    if (task.review?.decision) {
      const decisionColors: Record<string, (s: string) => string> = {
        'approved': chalk.green,
        'changes-requested': chalk.yellow,
        'rejected': chalk.red,
      };
      const color = decisionColors[task.review.decision] || chalk.white;
      line += color(`   ✓ ${task.review.decision}\n`);
    }
  }
  
  return line;
}

function formatTaskJson(task: Task): string {
  return JSON.stringify(task, null, 2);
}

function formatTasksJson(tasks: Task[]): string {
  return JSON.stringify(tasks, null, 2);
}

const program = new Command();

program
  .name('vk')
  .description('Veritas Kanban CLI - Task management for AI agents')
  .version('0.1.0');

// List tasks
program
  .command('list')
  .alias('ls')
  .description('List tasks')
  .option('-s, --status <status>', 'Filter by status (todo, in-progress, review, done)')
  .option('-t, --type <type>', 'Filter by type (code, research, content, automation)')
  .option('-p, --project <project>', 'Filter by project')
  .option('-v, --verbose', 'Show more details')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      const tasks = await api<Task[]>('/api/tasks');
      
      let filtered = tasks;
      if (options.status) {
        filtered = filtered.filter(t => t.status === options.status);
      }
      if (options.type) {
        filtered = filtered.filter(t => t.type === options.type);
      }
      if (options.project) {
        filtered = filtered.filter(t => t.project === options.project);
      }
      
      if (options.json) {
        console.log(formatTasksJson(filtered));
      } else if (filtered.length === 0) {
        console.log(chalk.dim('No tasks found'));
      } else {
        filtered.forEach(task => console.log(formatTask(task, options.verbose)));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Show task details
program
  .command('show <id>')
  .description('Show task details')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      // Support partial ID matching
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      if (options.json) {
        console.log(formatTaskJson(task));
      } else {
        console.log(formatTask(task, true));
        console.log(chalk.dim('─'.repeat(60)));
        console.log(chalk.dim(`ID: ${task.id}`));
        console.log(chalk.dim(`Created: ${new Date(task.created).toLocaleString()}`));
        console.log(chalk.dim(`Updated: ${new Date(task.updated).toLocaleString()}`));
        if (task.tags?.length) {
          console.log(chalk.dim(`Tags: ${task.tags.join(', ')}`));
        }
        if (task.description) {
          console.log('\n' + task.description);
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Create task
program
  .command('create <title>')
  .description('Create a new task')
  .option('-t, --type <type>', 'Task type (code, research, content, automation)', 'code')
  .option('-p, --project <project>', 'Project name')
  .option('-d, --description <desc>', 'Task description')
  .option('--priority <priority>', 'Priority (low, medium, high)', 'medium')
  .option('--json', 'Output as JSON')
  .action(async (title, options) => {
    try {
      const task = await api<Task>('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          type: options.type,
          project: options.project,
          description: options.description || '',
          priority: options.priority,
        }),
      });
      
      if (options.json) {
        console.log(formatTaskJson(task));
      } else {
        console.log(chalk.green('✓ Task created'));
        console.log(formatTask(task, true));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Update task
program
  .command('update <id>')
  .description('Update a task')
  .option('-s, --status <status>', 'New status')
  .option('-t, --type <type>', 'New type')
  .option('-p, --project <project>', 'New project')
  .option('--priority <priority>', 'New priority')
  .option('--title <title>', 'New title')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      // Support partial ID matching
      const tasks = await api<Task[]>('/api/tasks');
      const existing = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!existing) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      const updates: Record<string, unknown> = {};
      if (options.status) updates.status = options.status;
      if (options.type) updates.type = options.type;
      if (options.project) updates.project = options.project;
      if (options.priority) updates.priority = options.priority;
      if (options.title) updates.title = options.title;
      
      if (Object.keys(updates).length === 0) {
        console.error(chalk.yellow('No updates specified'));
        process.exit(1);
      }
      
      const task = await api<Task>(`/api/tasks/${existing.id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      
      if (options.json) {
        console.log(formatTaskJson(task));
      } else {
        console.log(chalk.green('✓ Task updated'));
        console.log(formatTask(task, true));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Start agent on task
program
  .command('start <id>')
  .description('Start an agent on a task')
  .option('-a, --agent <agent>', 'Agent to use (claude-code, amp, copilot, gemini)', 'claude-code')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      // Support partial ID matching
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      if (task.type !== 'code') {
        console.error(chalk.red('Can only start agents on code tasks'));
        process.exit(1);
      }
      
      if (!task.git?.worktreePath) {
        console.error(chalk.red('Task needs a worktree first. Create one via the UI.'));
        process.exit(1);
      }
      
      const result = await api<{ attemptId: string }>(`/api/agents/${task.id}/start`, {
        method: 'POST',
        body: JSON.stringify({ agent: options.agent }),
      });
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(chalk.green(`✓ Agent started: ${options.agent}`));
        console.log(chalk.dim(`Attempt ID: ${result.attemptId}`));
        console.log(chalk.dim(`Working in: ${task.git.worktreePath}`));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Stop agent
program
  .command('stop <id>')
  .description('Stop a running agent')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      await api(`/api/agents/${task.id}/stop`, { method: 'POST' });
      
      if (options.json) {
        console.log(JSON.stringify({ stopped: true }));
      } else {
        console.log(chalk.yellow('✓ Agent stopped'));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Archive task
program
  .command('archive <id>')
  .description('Archive a completed task')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      await api(`/api/tasks/${task.id}/archive`, { method: 'POST' });
      
      if (options.json) {
        console.log(JSON.stringify({ archived: true }));
      } else {
        console.log(chalk.green('✓ Task archived'));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// Delete task
program
  .command('delete <id>')
  .description('Delete a task')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    try {
      const tasks = await api<Task[]>('/api/tasks');
      const task = tasks.find(t => t.id === id || t.id.endsWith(id));
      
      if (!task) {
        console.error(chalk.red(`Task not found: ${id}`));
        process.exit(1);
      }
      
      await api(`/api/tasks/${task.id}`, { method: 'DELETE' });
      
      if (options.json) {
        console.log(JSON.stringify({ deleted: true }));
      } else {
        console.log(chalk.green('✓ Task deleted'));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parse();
