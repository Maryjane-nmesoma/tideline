import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(3)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(3)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(3)}K`;
  return n.toLocaleString();
}
