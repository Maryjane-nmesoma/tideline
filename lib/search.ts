import { fetchCctpByTx, type CctpLookup } from "@/lib/adapters/circle";
import type { CctpDomain } from "@/lib/config";
import { fetchLzByGuid, fetchLzByTx, fetchLzByWallet, fetchLzFeed } from "@/lib/adapters/layerzero";
import { decodeStrkey } from "@/lib/stellar";
import type { Transfer } from "@/lib/types";

export type QueryKind =
  | "evm-hash"
  | "stellar-hash"
  | "solana-signature"
  | "sui-digest"
  | "stellar-account"
  | "stellar-contract"
  | "evm-address"
  | "unknown";

export function classifyQuery(raw: string): QueryKind {
  const q = raw.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(q)) return "evm-hash";
  if (/^[0-9a-fA-F]{64}$/.test(q)) return "stellar-hash";
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) return "evm-address";
  const sk = decodeStrkey(q);
  if (sk) return sk.kind === "account" ? "stellar-account" : "stellar-contract";
  if (/^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(q)) return "solana-signature";
  if (/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(q)) return "sui-digest";
  return "unknown";
}

export type SearchResult = {
  query: string;
  kind: QueryKind;
  transfers: Transfer[];
  notes: string[];
};

function dedupe(list: Transfer[]) {
  const seen = new Set<string>();
  return list.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

/** Circle lookup that records how many chains could not be checked. */
async function cctp(hash: string, kind: CctpDomain["kind"], notes: string[]): Promise<Transfer[]> {
  try {
    const r: CctpLookup = await fetchCctpByTx(hash, kind);
    if (r.failed > 0 && r.transfers.length === 0) {
      notes.push(
        `Circle Iris could not be checked on ${r.failed} of ${r.probed} chains, so a CCTP transfer may have been missed. Try again.`
      );
    }
    return r.transfers;
  } catch (e) {
    notes.push(`Circle Iris is unavailable right now (${e instanceof Error ? e.message : "error"}).`);
    return [];
  }
}

async function settle<T>(p: Promise<T>, label: string, notes: string[]): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    notes.push(`${label} is unavailable right now (${e instanceof Error ? e.message : "error"}).`);
    return null;
  }
}

export async function searchTransfers(raw: string): Promise<SearchResult> {
  const q = raw.trim();
  const kind = classifyQuery(q);
  const notes: string[] = [];
  let transfers: Transfer[] = [];

  switch (kind) {
    case "evm-hash": {
      // 0x + 64 hex is either an EVM tx hash or a LayerZero GUID.
      const [byTx, byGuid, burns] = await Promise.all([
        settle(fetchLzByTx(q), "LayerZero Scan", notes),
        settle(fetchLzByGuid(q), "LayerZero Scan", notes),
        cctp(q, "evm", notes),
      ]);
      transfers = [...(byTx ?? []), ...(byGuid ? [byGuid] : []), ...burns];
      break;
    }
    case "stellar-hash": {
      // Stellar hashes carry no 0x prefix. A CCTP burn on Stellar is looked up on domain 27.
      const [lz, burns] = await Promise.all([
        settle(fetchLzByTx(q), "LayerZero Scan", notes),
        cctp(q, "stellar", notes),
      ]);
      transfers = [...(lz ?? []), ...burns];
      break;
    }
    case "solana-signature":
    case "sui-digest": {
      const [lz, burns] = await Promise.all([
        settle(fetchLzByTx(q), "LayerZero Scan", notes),
        cctp(q, kind === "sui-digest" ? "sui" : "solana", notes),
      ]);
      transfers = [...(lz ?? []), ...burns];
      break;
    }
    case "evm-address": {
      const r = await settle(fetchLzByWallet(q.toLowerCase()), "LayerZero Scan", notes);
      transfers = r ?? [];
      break;
    }
    case "stellar-account":
    case "stellar-contract": {
      const hex = `0x${decodeStrkey(q)!.hex}`;
      const [sent, inbound] = await Promise.all([
        settle(fetchLzByWallet(hex), "LayerZero Scan", notes),
        settle(fetchLzFeed({ direction: "inbound", limit: 100 }), "LayerZero Scan", notes),
      ]);
      const received = (inbound?.transfers ?? []).filter((t) => t.receiver.toLowerCase() === hex);
      transfers = [...(sent ?? []), ...received];
      notes.push(
        "Address search covers transfers this address sent, plus transfers it received among the 100 most recent inbound messages."
      );
      break;
    }
    default:
      notes.push(
        "Not recognized. Paste a transaction hash, a LayerZero GUID, a Solana or Sui transaction, or a Stellar G... or C... address."
      );
  }

  if (
    transfers.length === 0 &&
    ["evm-hash", "stellar-hash", "solana-signature", "sui-digest"].includes(kind) &&
    !notes.length
  ) {
    notes.push(
      "Nothing found. Circle and LayerZero index the source (burn or send) transaction, so a mint or receive transaction on the destination chain will not match. Search the source transaction instead."
    );
  }

  transfers = dedupe(transfers).sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return { query: q, kind, transfers, notes };
}
