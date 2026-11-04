import { fetchLzFeed } from "@/lib/adapters/layerzero";
import type { CorridorStat, Transfer } from "@/lib/types";

/** Pull every Stellar-touching LayerZero message newer than `hours`, capped by `maxPages` per direction. */
export async function fetchWindow(hours: number, maxPages: number) {
  // Round to the hour so identical windows share the fetch cache.
  const start = Math.floor((Date.now() / 1000 - hours * 3600) / 3600) * 3600;
  const collect = async (direction: "inbound" | "outbound") => {
    const rows: Transfer[] = [];
    let token: string | undefined;
    let capped = false;
    for (let i = 0; i < maxPages; i++) {
      const page = await fetchLzFeed({ direction, limit: 100, start, nextToken: token });
      rows.push(...page.transfers);
      if (!page.nextToken || page.transfers.length < 100) {
        token = undefined;
        break;
      }
      token = page.nextToken;
      if (i === maxPages - 1) capped = true;
    }
    return { rows, capped };
  };
  const [inb, out] = await Promise.all([collect("inbound"), collect("outbound")]);
  return { transfers: [...inb.rows, ...out.rows], capped: inb.capped || out.capped, start };
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export function summarize(transfers: Transfer[]) {
  const lat = transfers
    .map((t) => t.latencySeconds)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  const count = (s: Transfer["status"]) => transfers.filter((t) => t.status === s).length;
  return {
    total: transfers.length,
    inbound: transfers.filter((t) => t.direction === "inbound").length,
    outbound: transfers.filter((t) => t.direction === "outbound").length,
    completed: count("completed"),
    inFlight: count("attesting") + count("relaying"),
    stalled: count("stalled"),
    failed: count("failed"),
    medianLatencySeconds: percentile(lat, 0.5),
    p90LatencySeconds: percentile(lat, 0.9),
  };
}

export function buildCorridors(transfers: Transfer[]): CorridorStat[] {
  const map = new Map<string, Transfer[]>();
  for (const t of transfers) {
    const key = `${t.src.key}->${t.dst.key}`;
    map.set(key, [...(map.get(key) ?? []), t]);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const lat = list
        .map((t) => t.latencySeconds)
        .filter((n): n is number => n !== null)
        .sort((a, b) => a - b);
      return {
        key,
        from: list[0].src,
        to: list[0].dst,
        count: list.length,
        completed: list.filter((t) => t.status === "completed").length,
        stalled: list.filter((t) => t.status === "stalled" || t.status === "failed").length,
        medianLatencySeconds: percentile(lat, 0.5),
        p90LatencySeconds: percentile(lat, 0.9),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function dailyBuckets(transfers: Transfer[], days: number) {
  const dayMs = 86_400_000;
  const startOfToday = Math.floor(Date.now() / dayMs) * dayMs;
  const buckets = Array.from({ length: days }, (_, i) => ({
    date: startOfToday - (days - 1 - i) * dayMs,
    inbound: 0,
    outbound: 0,
  }));
  for (const t of transfers) {
    if (!t.createdAt) continue;
    const idx = Math.floor((t.createdAt * 1000 - buckets[0].date) / dayMs);
    if (idx < 0 || idx >= days) continue;
    if (t.direction === "inbound") buckets[idx].inbound++;
    else if (t.direction === "outbound") buckets[idx].outbound++;
  }
  return buckets;
}

const LATENCY_BUCKETS: [string, number][] = [
  ["Under 5m", 5 * 60],
  ["5 to 10m", 10 * 60],
  ["10 to 20m", 20 * 60],
  ["20 to 30m", 30 * 60],
  ["30 to 60m", 60 * 60],
  ["Over 60m", Infinity],
];

/** How many delivered transfers fell into each delivery time band. */
export function latencyHistogram(transfers: Transfer[]) {
  const counts = LATENCY_BUCKETS.map(([label]) => ({ label, count: 0 }));
  for (const t of transfers) {
    if (t.latencySeconds === null) continue;
    const i = LATENCY_BUCKETS.findIndex(([, max]) => t.latencySeconds! < max);
    counts[i === -1 ? counts.length - 1 : i].count++;
  }
  return counts;
}

/** Transfers grouped by the chain on the other side from Stellar. */
export function byPartnerChain(transfers: Transfer[]) {
  const map = new Map<string, { key: string; name: string; count: number }>();
  for (const t of transfers) {
    const other = t.src.key === "stellar" ? t.dst : t.src;
    // A message from Stellar to Stellar (testing, local sends) has no partner chain.
    const selfRoute = t.src.key === "stellar" && t.dst.key === "stellar";
    const name = selfRoute ? "Stellar (to itself)" : other.name;
    const row = map.get(name) ?? { key: other.key, name, count: 0 };
    row.count++;
    map.set(name, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
