import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useConfig, useUpdateAgents } from '@/hooks/useConfig';
import { useFeatureSettings, useDebouncedFeatureUpdate } from '@/hooks/useFeatureSettings';
import { Bot, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import type { AgentConfig, AgentType } from '@veritas-kanban/shared';
import { DEFAULT_FEATURE_SETTINGS } from '@veritas-kanban/shared';
import { cn } from '@/lib/utils';
import { ToggleRow, NumberRow, SectionHeader, SaveIndicator } from '../shared';

export function AgentsTab() {
  const { data: config, isLoading } = useConfig();
  const { settings } = useFeatureSettings();
  const { debouncedUpdate, isPending } = useDebouncedFeatureUpdate();
  const updateAgents = useUpdateAgents();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);

  const update = (key: string, value: any) => {
    debouncedUpdate({ agents: { [key]: value } });
  };

  const handleToggleAgent = (agentType: AgentType) => {
    if (!config) return;
    const updatedAgents = config.agents.map((a) =>
      a.type === agentType ? { ...a, enabled: !a.enabled } : a
    );
    updateAgents.mutate(updatedAgents);
  };

  const handleAddAgent = (agent: AgentConfig) => {
    if (!config) return;
    updateAgents.mutate([...config.agents, agent]);
    setShowAddForm(false);
  };

  const handleEditAgent = (originalType: string, updated: AgentConfig) => {
    if (!config) return;
    const updatedAgents = config.agents.map((a) => (a.type === originalType ? updated : a));
    updateAgents.mutate(updatedAgents);
    setEditingAgent(null);
  };

  const handleRemoveAgent = (agentType: string) => {
    if (!config) return;
    const updatedAgents = config.agents.filter((a) => a.type !== agentType);
    updateAgents.mutate(updatedAgents);
  };

  const resetAgents = () => {
    debouncedUpdate({ agents: DEFAULT_FEATURE_SETTINGS.agents });
  };

  const isDefault = (type: string) => config?.defaultAgent === type;

  return (
    <div className="space-y-6">
      {/* Agent List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Installed Agents</h3>
          {!showAddForm && (
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Agent
            </Button>
          )}
        </div>

        {showAddForm && (
          <AgentForm
            existingTypes={config?.agents.map((a) => a.type) || []}
            onSubmit={handleAddAgent}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : config?.agents.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center border rounded-md border-dashed">
            No agents configured. Add one to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {config?.agents.map((agent) =>
              editingAgent === agent.type ? (
                <AgentForm
                  key={agent.type}
                  agent={agent}
                  existingTypes={config.agents
                    .filter((a) => a.type !== agent.type)
                    .map((a) => a.type)}
                  onSubmit={(updated) => handleEditAgent(agent.type, updated)}
                  onCancel={() => setEditingAgent(null)}
                />
              ) : (
                <AgentItem
                  key={agent.type}
                  agent={agent}
                  isDefault={isDefault(agent.type)}
                  onToggle={() => handleToggleAgent(agent.type)}
                  onEdit={() => setEditingAgent(agent.type)}
                  onRemove={() => handleRemoveAgent(agent.type)}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Agent Behavior */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader title="Agent Behavior" onReset={resetAgents} />
          <SaveIndicator isPending={isPending} />
        </div>
        <div className="divide-y">
          <NumberRow
            label="Timeout"
            description="Kill agent process after N minutes (5-480)"
            value={settings.agents.timeoutMinutes}
            onChange={(v) => update('timeoutMinutes', v)}
            min={5}
            max={480}
            unit="min"
            hideSpinners
            maxLength={3}
          />
          <ToggleRow
            label="Auto-Commit on Complete"
            description="Automatically commit changes when agent finishes successfully"
            checked={settings.agents.autoCommitOnComplete}
            onCheckedChange={(v) => update('autoCommitOnComplete', v)}
          />
          <ToggleRow
            label="Auto-Cleanup Worktrees"
            description="Remove worktree when task is archived"
            checked={settings.agents.autoCleanupWorktrees}
            onCheckedChange={(v) => update('autoCleanupWorktrees', v)}
          />
          <ToggleRow
            label="Preview Panel"
            description="Show preview panel in task detail view"
            checked={settings.agents.enablePreview}
            onCheckedChange={(v) => update('enablePreview', v)}
          />
        </div>
      </div>
    </div>
  );
}

// ============ Agent Item (display mode) ============

interface AgentItemProps {
  agent: AgentConfig;
  isDefault: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

function AgentItem({ agent, isDefault, onToggle, onEdit, onRemove }: AgentItemProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between py-2 px-3 rounded-md border',
        agent.enabled ? 'bg-card' : 'bg-muted/30'
      )}
    >
      <div className="flex items-center gap-3">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="flex items-center gap-2">
            <span className={cn('font-medium text-sm', !agent.enabled && 'text-muted-foreground')}>
              {agent.name}
            </span>
            {isDefault && (
              <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                Default
              </span>
            )}
          </div>
          <code className="text-xs text-muted-foreground">
            {agent.command} {agent.args.join(' ')}
          </code>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onEdit}
          aria-label={`Edit ${agent.name}`}
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        {isDefault ? (
          <span
            className="text-xs text-muted-foreground px-1"
            title="Cannot remove the default agent"
          >
            —
          </span>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`Remove ${agent.name}`}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove agent?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove &ldquo;{agent.name}&rdquo; ({agent.type}) from your agent
                  configuration.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onRemove}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Switch
          checked={agent.enabled}
          onCheckedChange={onToggle}
          aria-label={`Enable ${agent.name}`}
        />
      </div>
    </div>
  );
}

// ============ Agent Form (add/edit mode) ============

interface AgentFormProps {
  agent?: AgentConfig;
  existingTypes: string[];
  onSubmit: (agent: AgentConfig) => void;
  onCancel: () => void;
}

function AgentForm({ agent, existingTypes, onSubmit, onCancel }: AgentFormProps) {
  const isEditing = !!agent;
  const [name, setName] = useState(agent?.name || '');
  const [type, setType] = useState(agent?.type || '');
  const [command, setCommand] = useState(agent?.command || '');
  const [argsStr, setArgsStr] = useState(agent?.args.join(' ') || '');

  const typeSlug =
    type ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const isDuplicate = !isEditing && existingTypes.includes(typeSlug);
  const isValid = name.trim() && command.trim() && !isDuplicate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onSubmit({
      type: (isEditing ? agent.type : typeSlug) as AgentType,
      name: name.trim(),
      command: command.trim(),
      args: argsStr
        .trim()
        .split(/\s+/)
        .filter((a) => a),
      enabled: agent?.enabled ?? true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Bot className="h-4 w-4" />
        {isEditing ? `Edit ${agent.name}` : 'Add Agent'}
      </div>

      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="agent-name">Display Name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Custom Agent"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="agent-type">
              Type Slug
              {!isEditing && typeSlug && (
                <span className="text-xs text-muted-foreground ml-1">({typeSlug})</span>
              )}
            </Label>
            <Input
              id="agent-type"
              value={isEditing ? agent.type : type}
              onChange={(e) => setType(e.target.value)}
              placeholder="auto-generated from name"
              disabled={isEditing}
              className={cn(isDuplicate && 'border-red-500')}
            />
            {isDuplicate && (
              <p className="text-xs text-red-500">An agent with this type already exists</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="agent-command">Command</Label>
            <Input
              id="agent-command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., claude"
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="agent-args">Arguments (space-separated)</Label>
            <Input
              id="agent-args"
              value={argsStr}
              onChange={(e) => setArgsStr(e.target.value)}
              placeholder="e.g., --flag -p"
              className="font-mono text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5 mr-1" /> Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!isValid}>
          <Check className="h-3.5 w-3.5 mr-1" /> {isEditing ? 'Save' : 'Add Agent'}
        </Button>
      </div>
    </form>
  );
}
