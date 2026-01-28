import {
  useFeatureSettings,
  useDebouncedFeatureUpdate,
} from '@/hooks/useFeatureSettings';
import { DEFAULT_FEATURE_SETTINGS } from '@veritas-kanban/shared';
import { ToggleRow, NumberRow, SectionHeader, SaveIndicator } from '../shared';

export function DataTab() {
  const { settings } = useFeatureSettings();
  const { debouncedUpdate, isPending } = useDebouncedFeatureUpdate();

  const updateTelemetry = (key: string, value: any) => {
    debouncedUpdate({ telemetry: { [key]: value } });
  };

  const updateArchive = (key: string, value: any) => {
    debouncedUpdate({ archive: { [key]: value } });
  };

  const resetData = () => {
    debouncedUpdate({
      telemetry: DEFAULT_FEATURE_SETTINGS.telemetry,
      archive: DEFAULT_FEATURE_SETTINGS.archive,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Telemetry & Data" onReset={resetData} />
        <SaveIndicator isPending={isPending} />
      </div>

      {/* Telemetry */}
      <div className="divide-y">
        <ToggleRow
          label="Telemetry Collection"
          description="Master toggle for all telemetry event collection"
          checked={settings.telemetry.enabled}
          onCheckedChange={(v) => updateTelemetry('enabled', v)}
        />
        {settings.telemetry.enabled && (
          <>
            <NumberRow
              label="Retention Period"
              description="Auto-purge events older than N days (7-365)"
              value={settings.telemetry.retentionDays}
              onChange={(v) => updateTelemetry('retentionDays', v)}
              min={7}
              max={365}
              unit="days"
            />
            <ToggleRow
              label="Trace Collection"
              description="Enable detailed trace collection for agent runs"
              checked={settings.telemetry.enableTraces}
              onCheckedChange={(v) => updateTelemetry('enableTraces', v)}
            />
            <ToggleRow
              label="Activity Tracking"
              description="Log activity events for the sidebar"
              checked={settings.telemetry.enableActivityTracking}
              onCheckedChange={(v) => updateTelemetry('enableActivityTracking', v)}
            />
          </>
        )}
      </div>

      {/* Archive */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Archive</h4>
        <div className="divide-y">
          <ToggleRow
            label="Auto-Archive"
            description="Automatically archive completed sprints"
            checked={settings.archive.autoArchiveEnabled}
            onCheckedChange={(v) => updateArchive('autoArchiveEnabled', v)}
          />
          {settings.archive.autoArchiveEnabled && (
            <NumberRow
              label="Archive After"
              description="Days after completion before auto-archiving"
              value={settings.archive.autoArchiveAfterDays}
              onChange={(v) => updateArchive('autoArchiveAfterDays', v)}
              min={1}
              max={365}
              unit="days"
            />
          )}
        </div>
      </div>
    </div>
  );
}
