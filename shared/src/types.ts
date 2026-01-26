// Task Types

export type TaskType = 'code' | 'research' | 'content' | 'automation';
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type AgentType = 'claude-code' | 'amp' | 'copilot' | 'gemini' | 'veritas';
export type AttemptStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface TaskGit {
  repo: string;
  branch: string;
  baseBranch: string;
  worktreePath?: string;
}

export interface TaskAttempt {
  id: string;
  agent: AgentType;
  status: AttemptStatus;
  started?: string;
  ended?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  project?: string;
  tags?: string[];
  created: string;
  updated: string;

  // Code task specific
  git?: TaskGit;

  // Current attempt
  attempt?: TaskAttempt;

  // Attempt history
  attempts?: TaskAttempt[];

  // Review comments (for code tasks)
  reviewComments?: ReviewComment[];

  // Review state
  review?: ReviewState;

  // Automation task specific (for veritas sub-agent)
  automation?: {
    sessionKey?: string;    // Clawdbot session key
    spawnedAt?: string;     // When sub-agent was spawned
    completedAt?: string;   // When sub-agent finished
    result?: string;        // Result summary from sub-agent
  };
}

export interface ReviewComment {
  id: string;
  file: string;
  line: number;
  content: string;
  created: string;
}

export type ReviewDecision = 'approved' | 'changes-requested' | 'rejected';

export interface ReviewState {
  decision?: ReviewDecision;
  decidedAt?: string;
  summary?: string;
}

// API Types

export interface CreateTaskInput {
  title: string;
  description?: string;
  type?: TaskType;
  priority?: TaskPriority;
  project?: string;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  project?: string;
  tags?: string[];
  git?: Partial<TaskGit>;
  attempt?: TaskAttempt;
  reviewComments?: ReviewComment[];
  review?: ReviewState;
  automation?: {
    sessionKey?: string;
    spawnedAt?: string;
    completedAt?: string;
    result?: string;
  };
}

export interface TaskFilters {
  status?: TaskStatus | TaskStatus[];
  type?: TaskType | TaskType[];
  project?: string;
  search?: string;
}

// Config Types

export interface RepoConfig {
  name: string;
  path: string;
  defaultBranch: string;
}

export interface AgentConfig {
  type: AgentType;
  name: string;
  command: string;
  args: string[];
  enabled: boolean;
}

export interface AppConfig {
  repos: RepoConfig[];
  agents: AgentConfig[];
  defaultAgent: AgentType;
}

// WebSocket Message Types

export type WSMessageType = 
  | 'agent:output'
  | 'agent:status'
  | 'agent:complete'
  | 'task:updated'
  | 'error';

export interface WSMessage {
  type: WSMessageType;
  taskId?: string;
  attemptId?: string;
  data: unknown;
  timestamp: string;
}

export interface AgentOutputMessage extends WSMessage {
  type: 'agent:output';
  data: {
    stream: 'stdout' | 'stderr';
    content: string;
  };
}

export interface AgentStatusMessage extends WSMessage {
  type: 'agent:status';
  data: {
    status: AttemptStatus;
    exitCode?: number;
  };
}
