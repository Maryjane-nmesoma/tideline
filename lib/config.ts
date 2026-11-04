// Chain registry and endpoints. Values verified against live APIs (2026-10-22):
// LayerZero metadata (stellar eid 30600), Circle CCTP domains (Stellar = 27).

export const STELLAR_LZ_EID = 30600;
export const STELLAR_CCTP_DOMAIN = 27;

export const ENDPOINTS = {
  layerzero: "https://scan.layerzero-api.com/v1",
  iris: "https://iris-api.circle.com/v2",
  horizon: "https://horizon.stellar.org",
  stablecoins: "https://stablecoins.llama.fi",
} as const;

export type ChainInfo = {
  key: string;
  name: string;
  /** LayerZero V2 mainnet endpoint id */
  lzEid?: number;
  /** Circle CCTP domain id */
  cctpDomain?: number;
};

// LayerZero V2 mainnet eids and CCTP domains for the chains Stellar corridors touch.
export const CHAINS: ChainInfo[] = [
  { key: "stellar", name: "Stellar", lzEid: 30600, cctpDomain: 27 },
  { key: "ethereum", name: "Ethereum", lzEid: 30101, cctpDomain: 0 },
  { key: "arbitrum", name: "Arbitrum", lzEid: 30110, cctpDomain: 3 },
  { key: "optimism", name: "Optimism", lzEid: 30111, cctpDomain: 2 },
  { key: "polygon", name: "Polygon", lzEid: 30109, cctpDomain: 7 },
  { key: "base", name: "Base", lzEid: 30184, cctpDomain: 6 },
  { key: "avalanche", name: "Avalanche", lzEid: 30106, cctpDomain: 1 },
  { key: "bsc", name: "BNB Chain", lzEid: 30102, cctpDomain: 17 },
  { key: "solana", name: "Solana", lzEid: 30168, cctpDomain: 5 },
  { key: "sui", name: "Sui", lzEid: 30378, cctpDomain: 8 },
  { key: "linea", name: "Linea", lzEid: 30183, cctpDomain: 11 },
  { key: "unichain", name: "Unichain", lzEid: 30320, cctpDomain: 10 },
  { key: "ink", name: "Ink", lzEid: 30339, cctpDomain: 21 },
  { key: "sonic", name: "Sonic", lzEid: 30332, cctpDomain: 13 },
  { key: "hyperevm", name: "HyperEVM", lzEid: 30367, cctpDomain: 19 },
  { key: "mantle", name: "Mantle", lzEid: 30181 },
  { key: "berachain", name: "Berachain", lzEid: 30362 },
  { key: "flare", name: "Flare", lzEid: 30295 },
  { key: "monad", name: "Monad", lzEid: 30390 },
  { key: "plasma", name: "Plasma", lzEid: 30383 },
  { key: "tempo", name: "Tempo", lzEid: 30410 },
  { key: "katana", name: "Katana", lzEid: 30375 },
  { key: "plume", name: "Plume", lzEid: 30318 },
  { key: "sei", name: "Sei", lzEid: 30280 },
  { key: "vana", name: "Vana", lzEid: 30330 },
];

// Every CCTP domain Circle lists, used to search a burn transaction on any source chain and to name results.
// kind says which transaction-hash format the chain uses.
export type CctpDomain = { domain: number; name: string; kind: "evm" | "solana" | "sui" | "stellar" | "other" };
export const CCTP_DOMAINS: CctpDomain[] = [
  { domain: 0, name: "Ethereum", kind: "evm" },
  { domain: 1, name: "Avalanche", kind: "evm" },
  { domain: 2, name: "OP Mainnet", kind: "evm" },
  { domain: 3, name: "Arbitrum", kind: "evm" },
  { domain: 4, name: "Noble", kind: "other" },
  { domain: 5, name: "Solana", kind: "solana" },
  { domain: 6, name: "Base", kind: "evm" },
  { domain: 7, name: "Polygon", kind: "evm" },
  { domain: 8, name: "Sui", kind: "sui" },
  { domain: 9, name: "Aptos", kind: "evm" },
  { domain: 10, name: "Unichain", kind: "evm" },
  { domain: 11, name: "Linea", kind: "evm" },
  { domain: 12, name: "Codex", kind: "evm" },
  { domain: 13, name: "Sonic", kind: "evm" },
  { domain: 14, name: "World Chain", kind: "evm" },
  { domain: 15, name: "Monad", kind: "evm" },
  { domain: 16, name: "Sei", kind: "evm" },
  { domain: 17, name: "BNB Chain", kind: "evm" },
  { domain: 18, name: "XDC", kind: "evm" },
  { domain: 19, name: "HyperEVM", kind: "evm" },
  { domain: 21, name: "Ink", kind: "evm" },
  { domain: 22, name: "Plume", kind: "evm" },
  { domain: 25, name: "Starknet", kind: "evm" },
  { domain: 26, name: "Arc", kind: "evm" },
  { domain: 27, name: "Stellar", kind: "stellar" },
  { domain: 28, name: "EDGE", kind: "evm" },
  { domain: 29, name: "Injective", kind: "evm" },
  { domain: 30, name: "Morph", kind: "evm" },
  { domain: 31, name: "Pharos", kind: "evm" },
  { domain: 32, name: "Cronos", kind: "evm" },
  { domain: 33, name: "Plasma", kind: "evm" },
  { domain: 37, name: "X Layer", kind: "evm" },
];

const byEid = new Map(CHAINS.filter((c) => c.lzEid).map((c) => [c.lzEid!, c]));
const byDomain = new Map(
  CHAINS.filter((c) => c.cctpDomain !== undefined).map((c) => [c.cctpDomain!, c])
);

export function chainByEid(eid: number): ChainInfo {
  return byEid.get(eid) ?? { key: `eid-${eid}`, name: `Chain ${eid}`, lzEid: eid };
}

export function chainByDomain(domain: number): ChainInfo {
  const known = byDomain.get(domain);
  if (known) return known;
  const listed = CCTP_DOMAINS.find((d) => d.domain === domain);
  return {
    key: listed ? listed.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : `domain-${domain}`,
    name: listed?.name ?? `Domain ${domain}`,
    cctpDomain: domain,
  };
}

export const STELLAR_CHAIN = chainByEid(STELLAR_LZ_EID);

export function explorerTxUrl(chainKey: string, hash: string): string | null {
  switch (chainKey) {
    case "stellar":
      return `https://stellar.expert/explorer/public/tx/${hash}`;
    case "ethereum":
      return `https://etherscan.io/tx/${hash}`;
    case "arbitrum":
      return `https://arbiscan.io/tx/${hash}`;
    case "optimism":
      return `https://optimistic.etherscan.io/tx/${hash}`;
    case "polygon":
      return `https://polygonscan.com/tx/${hash}`;
    case "base":
      return `https://basescan.org/tx/${hash}`;
    case "avalanche":
      return `https://snowtrace.io/tx/${hash}`;
    case "bsc":
      return `https://bscscan.com/tx/${hash}`;
    case "solana":
      return `https://solscan.io/tx/${hash}`;
    default:
      return null;
  }
}
