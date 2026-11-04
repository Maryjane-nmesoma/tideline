import { fetchRetry } from "@/lib/fetch";
import type { SepAmountRule, SepInfo } from "@/lib/types";

type Raw = any;

const TIMEOUT_MS = 6000;

async function getText(url: string) {
  const res = await fetchRetry(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 1800 },
    headers: { accept: "*/*" },
  });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.text();
}

/** Reads only the top-level key = "value" pairs of stellar.toml, which is all SEP-1 discovery needs. */
export function parseTopLevelToml(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (/^\s*\[/.test(line)) break; // first table ends the top-level section
    const m = /^\s*([A-Z_0-9]+)\s*=\s*"([^"]*)"/.exec(line);
    if (m && !(m[1] in out)) out[m[1]] = m[2];
  }
  return out;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function rules(block: Raw): SepAmountRule[] {
  if (!block || typeof block !== "object") return [];
  return Object.entries(block).map(([asset, v]: [string, Raw]) => ({
    asset,
    enabled: v?.enabled !== false,
    feeFixed: num(v?.fee_fixed),
    feePercent: num(v?.fee_percent),
    min: num(v?.min_amount),
    max: num(v?.max_amount),
  }));
}

async function info(server: string) {
  const text = await getText(`${server.replace(/\/$/, "")}/info`);
  return JSON.parse(text) as Raw;
}

/** Live SEP-1 discovery plus SEP-6/24/31 /info. Throws if the institution's domain cannot be reached. */
export async function fetchSepInfo(domain: string): Promise<SepInfo> {
  const toml = parseTopLevelToml(await getText(`https://${domain}/.well-known/stellar.toml`));
  const s24 = toml.TRANSFER_SERVER_SEP0024;
  const s6 = toml.TRANSFER_SERVER;
  const s31 = toml.DIRECT_PAYMENT_SERVER;

  const [i24, i6, i31] = await Promise.all([
    s24 ? info(s24).catch(() => null) : null,
    s6 ? info(s6).catch(() => null) : null,
    s31 ? info(s31).catch(() => null) : null,
  ]);

  const merge = (a: SepAmountRule[], b: SepAmountRule[]) => {
    const seen = new Set(a.map((r) => r.asset));
    return [...a, ...b.filter((r) => !seen.has(r.asset))];
  };

  return {
    domain,
    services: { sep6: !!i6, sep24: !!i24, sep31: !!i31 },
    deposit: merge(rules(i24?.deposit), rules(i6?.deposit)),
    withdraw: merge(rules(i24?.withdraw), rules(i6?.withdraw)),
    receive: rules(i31?.receive),
  };
}
