import { fetchRetry } from "@/lib/fetch";
import type { AssetHistoryPoint, Institution, InstitutionAsset } from "@/lib/types";

const BASE = "https://api.stellar.expert/explorer/public";
const STROOP = 1e7;

type Raw = any;

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "Grupo Anchor S.A. dba Anclap" -> "Anclap" */
const ALIASES: Record<string, string> = { "Centre Consortium": "Circle" };

function displayName(legal: string) {
  const dba = /\bdba\s+(.+)$/i.exec(legal);
  const raw = (dba ? dba[1] : legal).split(",")[0].trim() || legal;
  return ALIASES[raw] ?? raw;
}

function toAsset(r: Raw): InstitutionAsset {
  const toml = r.tomlInfo ?? r.toml ?? {};
  const price = typeof r.price === "number" ? r.price : null;
  const supply = Number(r.supply ?? 0) / STROOP;
  return {
    code: r.code,
    issuer: toml.issuer ?? String(r.asset).split("-")[1] ?? "",
    contract: r.contract ?? null,
    name: toml.name ?? null,
    description: toml.desc ?? null,
    assetType: toml.anchorAssetType ?? null,
    anchorAsset: toml.anchorAsset ?? null,
    image: toml.image ?? null,
    supply,
    priceUsd: price,
    valueUsd: price !== null ? supply * price : 0,
    holders: Number(r.trustlines?.authorized ?? r.trustlines?.total ?? 0),
    fundedHolders: Number(r.trustlines?.funded ?? 0),
    payments: Number(r.payments ?? 0),
    trades: Number(r.trades ?? 0),
    rating: typeof r.rating?.average === "number" ? r.rating.average : null,
  };
}

// Issuers that matter to cross-chain flows into Stellar even though their tokens are not fiat-pegged.
const CROSS_CHAIN_ISSUERS = new Set([
  "everdawn-labs-limited", // USDT0 (LayerZero OFT)
  "apy-foundation-ltd", // Allbridge Core
  "paxos",
  "ondo-finance",
  "solv-protocol",
  "ultra-capital",
  "stronghold",
  "wirex",
]);

const REAL_WORLD_TYPES = new Set(["fiat", "bond"]);

/**
 * A "corridor" on Stellar is a financial institution that moves value in and out of the network.
 * Institutions are the issuers behind the top-rated assets, grouped by the organization name they
 * publish in stellar.toml, and kept when they issue fiat-pegged or bond tokens (as they declare in
 * stellar.toml) or are a known cross-chain issuer. Game and meme tokens are left out.
 */
export async function fetchInstitutions(): Promise<Institution[]> {
  const res = await fetchRetry(`${BASE}/asset?sort=rating&order=desc&limit=200`, {
    next: { revalidate: 900 },
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Stellar Expert responded ${res.status}`);
  const json = (await res.json()) as { _embedded: { records: Raw[] } };

  const groups = new Map<string, Raw[]>();
  for (const r of json._embedded.records) {
    const org: string | undefined = r.tomlInfo?.orgName;
    if (!org || r.asset === "XLM") continue;
    groups.set(org, [...(groups.get(org) ?? []), r]);
  }

  const out: Institution[] = [];
  const used = new Set<string>();
  for (const [legalName, rows] of groups) {
    const assets = rows.map(toAsset).sort((a, b) => b.valueUsd - a.valueUsd);
    const name = displayName(legalName);
    let slug = slugify(name) || slugify(legalName);
    if (used.has(slug)) slug = `${slug}-${slugify(rows[0].tomlInfo?.issuer?.slice(0, 6) ?? "x")}`;
    used.add(slug);
    const realWorld = assets.some((a) => a.assetType !== null && REAL_WORLD_TYPES.has(a.assetType));
    if (!realWorld && !CROSS_CHAIN_ISSUERS.has(slug)) continue;
    const currencies = [
      ...new Set(
        assets
          .map((a) => (a.assetType === "fiat" && a.anchorAsset ? a.anchorAsset : a.code))
          .filter((c) => c.length <= 12)
      ),
    ];
    out.push({
      slug,
      name,
      legalName,
      domain: rows.find((r) => r.domain)?.domain ?? null,
      logo: rows.find((r) => r.tomlInfo?.orgLogo)?.tomlInfo.orgLogo ?? null,
      assets,
      valueUsd: assets.reduce((a, x) => a + x.valueUsd, 0),
      holders: assets.reduce((a, x) => a + x.holders, 0),
      payments: assets.reduce((a, x) => a + x.payments, 0),
      currencies,
    });
  }
  return out.sort((a, b) => b.holders - a.holders);
}

export async function fetchInstitution(slug: string): Promise<Institution | null> {
  const all = await fetchInstitutions();
  return all.find((i) => i.slug === slug) ?? null;
}

/** Daily supply, holders and payments for one asset, newest `days` days. */
export async function fetchAssetHistory(code: string, issuer: string, days = 1100): Promise<AssetHistoryPoint[]> {
  const res = await fetchRetry(`${BASE}/asset/${encodeURIComponent(`${code}-${issuer}`)}/stats-history`, {
    next: { revalidate: 3600 },
    headers: { accept: "application/json" },
  });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Stellar Expert responded ${res.status}`);
  const rows = (await res.json()) as Raw[];
  return rows.slice(-days).map((r) => ({
    date: Number(r.ts),
    supply: Number(r.supply ?? 0) / STROOP,
    // trustlines is [total, authorized, funded]; authorized matches the holders figure used elsewhere
    holders: Number(r.trustlines?.[1] ?? r.trustlines?.[0] ?? 0),
    payments: Number(r.payments ?? 0),
  }));
}
