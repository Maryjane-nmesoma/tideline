import { fetchRetry } from "@/lib/fetch";
import type { SepAmountRule, SepInfo, SepService } from "@/lib/types";
import type { SepAssetMap, SepInfoDoc } from "@/lib/upstream";

/**
 * Anchors are often slow, and discovery is two requests in a row (stellar.toml, then /info), so each request gets
 * a generous budget. A service that times out is reported as unreachable, never as "not offered".
 */
export const SEP_TIMEOUT_MS = 12_000;

/**
 * Anchors control their stellar.toml, and this server fetches the URLs listed in it. Refuse anything that is not a
 * plain public HTTPS URL on the default port so a hostile file cannot aim the server at localhost, a cloud metadata
 * address or an internal host. IP literals are rejected outright because real anchors use names.
 * This does not defend against a public name that resolves to a private address (DNS rebinding); put egress filtering
 * in front of the deployment if that matters to you. See SECURITY.md.
 */
export function isPublicHttpsUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.port !== "" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host.includes(":") || /^\d+(\.\d+){3}$/.test(host)) return false;
  return !/(^|\.)(localhost|local|internal|localdomain|home\.arpa)$/.test(host);
}

async function getText(url: string) {
  if (!isPublicHttpsUrl(url)) throw new Error(`Refusing to contact a non-public address (${url.slice(0, 80)})`);
  const res = await fetchRetry(url, {
    signal: AbortSignal.timeout(SEP_TIMEOUT_MS),
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

export function rules(block: SepAssetMap | undefined): SepAmountRule[] {
  if (!block || typeof block !== "object") return [];
  return Object.entries(block).map(([asset, v]) => ({
    asset,
    enabled: v?.enabled !== false,
    feeFixed: num(v?.fee_fixed),
    feePercent: num(v?.fee_percent),
    min: num(v?.min_amount),
    max: num(v?.max_amount),
  }));
}

/** What asking one transfer server for /info produced. */
export type Probe =
  | { state: "absent" } // stellar.toml does not list this server
  | { state: "error"; message: string } // listed, but it did not answer
  | { state: "ok"; doc: SepInfoDoc };

async function probe(server: string | undefined): Promise<Probe> {
  if (!server) return { state: "absent" };
  try {
    const text = await getText(`${server.replace(/\/$/, "")}/info`);
    return { state: "ok", doc: JSON.parse(text) as SepInfoDoc };
  } catch (e) {
    return { state: "error", message: e instanceof Error ? e.message : "unreachable" };
  }
}

function merge(a: SepAmountRule[], b: SepAmountRule[]) {
  const seen = new Set(a.map((r) => r.asset));
  return [...a, ...b.filter((r) => !seen.has(r.asset))];
}

/** Pure assembly step, split out so the offered / not offered / unreachable logic can be tested without a network. */
export function buildSepInfo(domain: string, probes: Record<SepService, Probe>): SepInfo {
  const offered = (k: SepService) => probes[k].state === "ok";
  const doc = (k: SepService): SepInfoDoc | undefined => {
    const p = probes[k];
    return p.state === "ok" ? p.doc : undefined;
  };
  const unreachable = (Object.keys(probes) as SepService[]).filter((k) => probes[k].state === "error");

  return {
    domain,
    services: { sep6: offered("sep6"), sep24: offered("sep24"), sep31: offered("sep31") },
    unreachable,
    deposit: merge(rules(doc("sep24")?.deposit), rules(doc("sep6")?.deposit)),
    withdraw: merge(rules(doc("sep24")?.withdraw), rules(doc("sep6")?.withdraw)),
    receive: rules(doc("sep31")?.receive),
  };
}

/** Live SEP-1 discovery plus SEP-6/24/31 /info. Throws if the institution's domain cannot be reached. */
export async function fetchSepInfo(domain: string): Promise<SepInfo> {
  const toml = parseTopLevelToml(await getText(`https://${domain}/.well-known/stellar.toml`));
  const [sep24, sep6, sep31] = await Promise.all([
    probe(toml.TRANSFER_SERVER_SEP0024),
    probe(toml.TRANSFER_SERVER),
    probe(toml.DIRECT_PAYMENT_SERVER),
  ]);
  return buildSepInfo(domain, { sep6, sep24, sep31 });
}
