"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip, useChartTheme } from "@/components/charts";
import { cn } from "@/lib/utils";

/** Distinct hues for any number of slices. The golden angle never repeats a color for 13 or 130 items. */
export function sliceColor(i: number, dark: boolean) {
  return `hsl(${Math.round((i * 137.508) % 360)} ${dark ? 65 : 60}% ${dark ? 62 : 48}%)`;
}

export type RangeKey = "7D" | "30D" | "90D" | "1Y" | "All";
const RANGE_POINTS: Record<RangeKey, number> = { "7D": 7, "30D": 30, "90D": 90, "1Y": 365, All: Infinity };

/** Daily series, so a range is just the last N points. */
export function sliceRange<T>(data: T[], range: RangeKey): T[] {
  const n = RANGE_POINTS[range];
  return Number.isFinite(n) ? data.slice(-n) : data;
}

const dateOf = (v: number | string, unit: "s" | "ms") => new Date(unit === "s" ? Number(v) * 1000 : Number(v));

export type SeriesDef = { key: string; name: string; color?: "primary" | "secondary" };

export function SeriesAreaChart({
  data,
  series,
  xUnit = "ms",
  stacked = false,
  formatY,
  formatTip,
  className = "h-[300px]",
}: {
  data: Record<string, number>[];
  series: SeriesDef[];
  xUnit?: "s" | "ms";
  stacked?: boolean;
  formatY?: (v: number) => string;
  formatTip?: (v: number) => string;
  className?: string;
}) {
  const chart = useChartTheme();
  const color = (s: SeriesDef) => (s.color === "secondary" ? chart.stroke2 : chart.stroke);
  const multi = series.length > 1;
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 8 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color(s)} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color(s)} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={chart.cursor} strokeOpacity={0.4} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            minTickGap={40}
            tick={{ fontSize: 11, fill: chart.tick }}
            tickFormatter={(d: number) => dateOf(d, xUnit).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          />
          <YAxis
            width={64}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: chart.tick }}
            tickFormatter={formatY}
            domain={stacked ? [0, "auto"] : ["auto", "auto"]}
          />
          <Tooltip
            cursor={{ stroke: chart.cursor, strokeDasharray: "2 6" }}
            content={
              <ChartTooltip
                formatLabel={(l) =>
                  dateOf(l, xUnit).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                }
                formatValue={formatTip ?? formatY}
              />
            }
          />
          {multi && <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stackId={stacked ? "a" : undefined}
              stroke={color(s)}
              strokeWidth={2}
              fill={`url(#fill-${s.key})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export type Slice = { name: string; value: number; highlight?: boolean };

/** Donut with a legend that lists every slice. Small slices keep a minimum width so they stay visible. */
export function DonutShare({
  slices,
  formatValue,
  footnote,
  className,
}: {
  slices: Slice[];
  formatValue?: (v: number) => string;
  footnote?: string;
  className?: string;
}) {
  const chart = useChartTheme();
  const total = slices.reduce((a, s) => a + s.value, 0);
  const colored = slices.map((s, i) => ({ ...s, fill: sliceColor(i, chart.dark) }));
  return (
    <div className={className}>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={colored}
              dataKey="value"
              nameKey="name"
              innerRadius="45%"
              outerRadius="85%"
              minAngle={4}
              paddingAngle={1}
              stroke={chart.bg}
              strokeWidth={2}
            >
              {colored.map((s) => (
                <Cell key={s.name} fill={s.fill} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="no-scrollbar mt-3 max-h-80 space-y-1.5 overflow-y-auto">
        {colored.map((s) => {
          const share = total ? (s.value / total) * 100 : 0;
          return (
            <li key={s.name} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 shrink-0 rounded" style={{ background: s.fill }} />
              <span className={cn("min-w-0 truncate", s.highlight && "font-semibold")}>{s.name}</span>
              <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                {share < 0.01 ? "<0.01" : share.toFixed(share < 1 ? 2 : 1)}%
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        {footnote ?? `${slices.length} items. Small slices are drawn at a minimum width so they stay visible.`}
      </p>
    </div>
  );
}

/** Horizontal ranked bars. */
export function HorizontalBars({
  data,
  name,
  formatValue,
  labelWidth = 130,
  className = "h-[300px]",
}: {
  data: { name: string; value: number }[];
  name: string;
  formatValue?: (v: number) => string;
  labelWidth?: number;
  className?: string;
}) {
  const chart = useChartTheme();
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid horizontal={false} stroke={chart.cursor} strokeOpacity={0.4} />
          <XAxis
            type="number"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: chart.tick }}
            tickFormatter={formatValue}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={labelWidth}
            axisLine={false}
            tickLine={false}
            interval={0}
            tick={{ fontSize: 11, fill: chart.tick }}
          />
          <Tooltip cursor={{ fill: chart.cursor, fillOpacity: 0.2 }} content={<ChartTooltip formatValue={formatValue} />} />
          <Bar dataKey="value" name={name} fill={chart.stroke} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vertical columns, for histograms and per-day counts. */
export function ColumnChart({
  data,
  name,
  formatValue,
  color = "primary",
  xFormat,
  className = "h-[260px]",
}: {
  data: { label: string | number; value: number }[];
  name: string;
  formatValue?: (v: number) => string;
  color?: "primary" | "secondary";
  xFormat?: (v: string | number) => string;
  className?: string;
}) {
  const chart = useChartTheme();
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8 }}>
          <CartesianGrid vertical={false} stroke={chart.cursor} strokeOpacity={0.4} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            minTickGap={24}
            tick={{ fontSize: 11, fill: chart.tick }}
            tickFormatter={xFormat}
          />
          <YAxis
            width={48}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: chart.tick }}
            tickFormatter={formatValue}
          />
          <Tooltip
            cursor={{ fill: chart.cursor, fillOpacity: 0.2 }}
            content={<ChartTooltip formatLabel={xFormat ? (l) => xFormat(l) : undefined} formatValue={formatValue} />}
          />
          <Bar dataKey="value" name={name} fill={color === "secondary" ? chart.stroke2 : chart.stroke} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two bars per category, for comparing two measures side by side. */
export function GroupedColumns({
  data,
  a,
  b,
  formatValue,
  className = "h-[300px]",
}: {
  data: { label: string; a: number; b: number }[];
  a: string;
  b: string;
  formatValue?: (v: number) => string;
  className?: string;
}) {
  const chart = useChartTheme();
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8 }}>
          <CartesianGrid vertical={false} stroke={chart.cursor} strokeOpacity={0.4} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 11, fill: chart.tick }} />
          <YAxis
            width={56}
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: chart.tick }}
            tickFormatter={formatValue}
          />
          <Tooltip cursor={{ fill: chart.cursor, fillOpacity: 0.2 }} content={<ChartTooltip formatValue={formatValue} />} />
          <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="a" name={a} fill={chart.stroke} radius={[3, 3, 0, 0]} />
          <Bar dataKey="b" name={b} fill={chart.stroke2} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
