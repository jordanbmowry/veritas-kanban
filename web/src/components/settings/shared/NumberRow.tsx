import { Input } from '@/components/ui/input';
import { SettingRow } from './SettingRow';

export function NumberRow({ label, description, value, onChange, min, max, unit }: {
  label: string;
  description?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <SettingRow label={label} description={description}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) {
              const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, v));
              onChange(clamped);
            }
          }}
          min={min}
          max={max}
          className="w-20 h-8 text-right"
        />
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
    </SettingRow>
  );
}
