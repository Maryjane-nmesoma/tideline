import type { QueryKind } from "@/lib/search";

const LABELS: Record<QueryKind, string> = {
  "evm-hash": "an EVM transaction hash or LayerZero GUID",
  "stellar-hash": "a Stellar transaction hash",
  "solana-signature": "a Solana signature",
  "sui-digest": "a Sui transaction digest",
  "stellar-account": "a Stellar account (G...)",
  "stellar-contract": "a Soroban contract (C...)",
  "evm-address": "an EVM address",
  unknown: "an unrecognized value",
};

export function classifyKind(kind: QueryKind) {
  return LABELS[kind];
}
