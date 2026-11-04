"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const dark = mounted && resolvedTheme === "dark";
  return {
    dark,
    stroke: dark ? "#60A5FA" : "#2563eb",
    stroke2: dark ? "#34D399" : "#059669",
    tick: dark ? "#A0A0A0" : "#666666",
    cursor: dark ? "#64748b" : "#cbd5e1",
    bg: dark ? "#0d0d0d" : "#ffffff",
    palette: dark
      ? ["#60A5FA", "#34D399", "#F87171", "#A78BFA", "#FB923C", "#EC4899", "#14B8A6", "#FBBF24"]
      : ["#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#F97316", "#EC4899", "#14B8A6", "#F59E0B"],
  };
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  formatValue,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string | number;
  formatLabel?: (l: string | number) => string;
  formatValue?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover p-2 text-xs shadow-lg">
      <div className="mb-1 text-muted-foreground">
        {label !== undefined ? (formatLabel ? formatLabel(label) : label) : null}
      </div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold tabular-nums">
            {formatValue ? formatValue(p.value ?? 0) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RangeToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-md border p-1" role="group">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={`rounded px-3 py-1 text-xs transition-colors ${
            value === o ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
