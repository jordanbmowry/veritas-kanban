import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDuration, parseDuration } from '@/hooks/useTimeTracking';
import { useTasks } from '@/hooks/useTasks';
import { api } from '@/lib/api';
import { Play, Square, Plus, Trash2, Clock, Loader2, Timer } from 'lucide-react';
import type { Task, TimeEntry, TimeTracking } from '@veritas-kanban/shared';
import { cn } from '@/lib/utils';
import { sanitizeText } from '@/lib/sanitize';

interface TimeTrackingSectionProps {
  task: Task;
}

// ─── Running Timer Display ──────────────────────────────────────────────────

function RunningTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  return (
    <span className="font-mono tabular-nums text-green-600 dark:text-green-400">
      {formatDuration(elapsed)}
    </span>
  );
}

// ─── Helper: update task in React Query cache ───────────────────────────────

function patchCache(queryClient: ReturnType<typeof useQueryClient>, task: Task) {
  queryClient.setQueryData<Task[]>(['tasks'], (old) =>
    old ? old.map((t) => (t.id === task.id ? task : t)) : old
  );
  queryClient.setQueryData(['tasks', task.id], task);
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function TimeTrackingSection({ task }: TimeTrackingSectionProps) {
  const queryClient = useQueryClient();

  // ── Local state: the single source of truth for this component ──
  // Initialized from prop, then updated directly from API responses.
  const [timeTracking, setTimeTracking] = useState<TimeTracking | undefined>(task.timeTracking);
  const [busy, setBusy] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [durationInput, setDurationInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');

  // Track the task ID so we can reset state when switching tasks
  const taskIdRef = useRef(task.id);

  // Reset local state when a different task is opened
  useEffect(() => {
    if (task.id !== taskIdRef.current) {
      taskIdRef.current = task.id;
      setTimeTracking(task.timeTracking);
    }
  }, [task.id, task.timeTracking]);

  // Sync from the query cache when it updates externally (WebSocket events,
  // background refetches, other components' mutations).
  // Skip while a local mutation is in flight to prevent stale data flicker.
  const { data: allTasks } = useTasks();
  const cachedTask = allTasks?.find((t) => t.id === task.id);

  // Use a JSON fingerprint to detect meaningful changes without
  // firing on every React Query structural-sharing pass.
  const cachedFingerprint = cachedTask?.timeTracking
    ? `${cachedTask.timeTracking.isRunning}-${cachedTask.timeTracking.totalSeconds}-${cachedTask.timeTracking.entries?.length ?? 0}-${cachedTask.timeTracking.activeEntryId ?? ''}`
    : '';

  useEffect(() => {
    if (!busy && cachedTask?.timeTracking) {
      setTimeTracking(cachedTask.timeTracking);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedFingerprint, busy]);

  // ── Derived state ──
  const isRunning = timeTracking?.isRunning ?? false;
  const totalSeconds = timeTracking?.totalSeconds ?? 0;
  const entries = timeTracking?.entries ?? [];
  const activeEntry = entries.find((e) => e.id === timeTracking?.activeEntryId);

  // ── Handlers ──

  const handleStartStop = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let result: Task;
      if (isRunning) {
        result = await api.time.stop(task.id);
      } else {
        result = await api.time.start(task.id);
      }
      // Update local state directly from the API response — instant UI update
      setTimeTracking(result.timeTracking);
      // Also update the query cache so other components see the change
      patchCache(queryClient, result);
    } catch (err) {
      console.warn('[TimeTracking] start/stop failed, syncing from server:', err);
      // Force a full refresh so UI converges with server state
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } finally {
      setBusy(false);
      // Background refresh to catch any side effects (e.g., auto-stopped timer
      // on another task). Small delay to avoid racing with the cache patch.
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['time', 'summary'] });
      }, 100);
    }
  };

  const handleAddEntry = async () => {
    const seconds = parseDuration(durationInput);
    if (!seconds || busy) return;
    setBusy(true);
    try {
      const result = await api.time.addEntry(task.id, seconds, descriptionInput || undefined);
      setTimeTracking(result.timeTracking);
      patchCache(queryClient, result);
      setDurationInput('');
      setDescriptionInput('');
      setAddDialogOpen(false);
    } catch (err) {
      console.warn('[TimeTracking] add entry failed:', err);
    } finally {
      setBusy(false);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['time', 'summary'] });
      }, 100);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.time.deleteEntry(task.id, entryId);
      setTimeTracking(result.timeTracking);
      patchCache(queryClient, result);
    } catch (err) {
      console.warn('[TimeTracking] delete entry failed:', err);
    } finally {
      setBusy(false);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['time', 'summary'] });
      }, 100);
    }
  };

  // ── Formatters ──

  const formatEntryTime = (entry: TimeEntry) => {
    const date = new Date(entry.startTime);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Time Tracking
        </Label>
        <span className="text-sm font-medium">Total: {formatDuration(totalSeconds)}</span>
      </div>

      <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
        {/* Timer Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isRunning ? (
              /* Timer is running on THIS task — show Stop */
              <Button variant="destructive" size="sm" onClick={handleStartStop} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </>
                )}
              </Button>
            ) : (
              /* Timer not running on this task — show Start */
              <Button variant="default" size="sm" onClick={handleStartStop} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start
                  </>
                )}
              </Button>
            )}

            {isRunning && activeEntry && (
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-green-500 animate-pulse" />
                <RunningTimer startTime={activeEntry.startTime} />
              </div>
            )}
          </div>

          {/* Add Manual Entry */}
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Time
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Time Entry</DialogTitle>
                <DialogDescription>Manually add time spent on this task.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    value={durationInput}
                    onChange={(e) => setDurationInput(e.target.value)}
                    placeholder="e.g., 1h 30m or 45m or 30"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter as &quot;1h 30m&quot;, &quot;45m&quot;, or just minutes (e.g.,
                    &quot;30&quot;)
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    value={descriptionInput}
                    onChange={(e) => setDescriptionInput(e.target.value)}
                    placeholder="What did you work on?"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddEntry} disabled={!parseDuration(durationInput) || busy}>
                  {busy ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Entry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Time Entries List */}
        {entries.length > 0 && (
          <div className="border-t pt-3">
            <Label className="text-xs text-muted-foreground mb-2 block">
              Time Entries ({entries.length})
            </Label>
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {entries
                  .slice()
                  .reverse()
                  .map((entry) => {
                    const isActive = entry.id === timeTracking?.activeEntryId;
                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          'flex items-center justify-between p-2 rounded text-sm',
                          isActive ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/50'
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isActive ? (
                              <Timer className="h-3 w-3 text-green-500 animate-pulse flex-shrink-0" />
                            ) : (
                              <Clock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="font-medium">
                              {entry.duration != null ? (
                                formatDuration(entry.duration)
                              ) : (
                                <RunningTimer startTime={entry.startTime} />
                              )}
                            </span>
                            {entry.manual && (
                              <span className="text-xs text-muted-foreground">(manual)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground pl-5 truncate">
                            {entry.description
                              ? sanitizeText(entry.description)
                              : formatEntryTime(entry)}
                          </div>
                        </div>
                        {!isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteEntry(entry.id)}
                            disabled={busy}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
