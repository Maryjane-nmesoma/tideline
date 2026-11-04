export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "n/a";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h < 48) return rem ? `${h}h ${rem}m` : `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function formatAgo(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return "n/a";
  const diff = Math.max(0, Date.now() / 1000 - unixSeconds);
  if (diff < 45) return "just now";
  return `${formatDuration(diff)} ago`;
}

export function formatDateTime(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return "n/a";
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatUsd(n: number | null | undefined, compact = true): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  if (compact) {
    const abs = Math.abs(n);
    if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  }
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatAmount(wireAmount: string | null, asset: string | null): string {
  if (!wireAmount) return "n/a";
  const [w, f] = wireAmount.split(".");
  const whole = w.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${f ? `${whole}.${f}` : whole}${asset ? ` ${asset}` : ""}`;
}

export function pctChange(now: number, prev: number): number | null {
  if (!prev) return null;
  return ((now - prev) / prev) * 100;
}

export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "n/a";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}
