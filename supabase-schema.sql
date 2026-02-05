-- Veritas Kanban PostgreSQL Schema for Supabase
-- Created: 2026-02-04

-- ============================================================
-- TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  type TEXT NOT NULL DEFAULT 'task',
  priority INT,
  sprint_id TEXT,
  project_id TEXT,
  assigned_to TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX idx_tasks_archived_at ON tasks(archived_at);

-- ============================================================
-- TASK TEMPLATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS task_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  template_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_templates_name ON task_templates(name);

-- ============================================================
-- SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES 
  ('feature_settings', '{}'),
  ('task_types', '["task", "bug", "feature", "improvement"]'),
  ('task_statuses', '["todo", "in_progress", "review", "done"]'),
  ('priorities', '["critical", "high", "medium", "low"]')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- ACTIVITY LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  task_id TEXT,
  task_title TEXT,
  details JSONB DEFAULT '{}',
  agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_activities_task_id ON activities(task_id);
CREATE INDEX idx_activities_type ON activities(type);

-- ============================================================
-- STATUS HISTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS status_history (
  id TEXT PRIMARY KEY,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  task_id TEXT,
  task_title TEXT,
  sub_agent_count INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_status_history_created_at ON status_history(created_at DESC);
CREATE INDEX idx_status_history_task_id ON status_history(task_id);

-- ============================================================
-- DAILY SUMMARIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_summaries (
  date DATE PRIMARY KEY,
  tasks_created INT DEFAULT 0,
  tasks_completed INT DEFAULT 0,
  tasks_updated INT DEFAULT 0,
  agent_status_changes INT DEFAULT 0,
  summary JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TELEMETRY EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS telemetry_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  task_id TEXT,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_telemetry_created_at ON telemetry_events(created_at DESC);
CREATE INDEX idx_telemetry_type ON telemetry_events(type);
CREATE INDEX idx_telemetry_task_id ON telemetry_events(task_id);

-- ============================================================
-- MANAGED LISTS (Projects, Sprints, Priorities, Task Types)
-- ============================================================
CREATE TABLE IF NOT EXISTS managed_lists (
  id TEXT PRIMARY KEY,
  list_type TEXT NOT NULL, -- 'project', 'sprint', 'priority', 'task_type'
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_hidden BOOLEAN DEFAULT FALSE,
  "order" INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(list_type, name)
);

CREATE INDEX idx_managed_lists_type ON managed_lists(list_type);
CREATE INDEX idx_managed_lists_order ON managed_lists("order");

-- ============================================================
-- BACKLOG TASKS TABLE (archived/deferred tasks)
-- ============================================================
CREATE TABLE IF NOT EXISTS backlog_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  moved_to_backlog_at TIMESTAMPTZ DEFAULT NOW(),
  original_created_at TIMESTAMPTZ,
  original_updated_at TIMESTAMPTZ
);

CREATE INDEX idx_backlog_moved_at ON backlog_tasks(moved_to_backlog_at DESC);

-- ============================================================
-- CHAT HISTORY TABLE (for Agent integrations)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  agent_id TEXT,
  session_id TEXT,
  message TEXT,
  role TEXT, -- 'user', 'assistant'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_session_id ON chat_history(session_id);
CREATE INDEX idx_chat_created_at ON chat_history(created_at DESC);

-- ============================================================
-- AUDIT LOG TABLE (optional, for tracking changes)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  table_name TEXT,
  operation TEXT, -- 'INSERT', 'UPDATE', 'DELETE'
  record_id TEXT,
  old_values JSONB,
  new_values JSONB,
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_table ON audit_log(table_name);

-- ============================================================
-- ENABLE RLS (Row Level Security) - Optional but Recommended
-- ============================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_lists ENABLE ROW LEVEL SECURITY;

-- Default RLS policy: allow all (public access for now)
-- You can tighten this later with proper authentication
CREATE POLICY "Allow public access" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow public access" ON task_templates FOR ALL USING (true);
CREATE POLICY "Allow public access" ON activities FOR ALL USING (true);
CREATE POLICY "Allow public access" ON status_history FOR ALL USING (true);
CREATE POLICY "Allow public access" ON telemetry_events FOR ALL USING (true);
CREATE POLICY "Allow public access" ON managed_lists FOR ALL USING (true);
