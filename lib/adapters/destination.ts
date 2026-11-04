import { ENDPOINTS } from "@/lib/config";
import { bytesToHex, hexToBytes, keccak256 } from "@/lib/keccak";
import { findProgramAddress } from "@/lib/solana";

/* Verifying a CCTP mint. Circle's Iris API only says a burn was attested; it never says the mint happened,
   so we ask the destination chain directly. */

export type MintCheck = {
  state: "minted" | "pending" | "unknown";
  txHash?: string;
  /** Unix seconds */
  timestamp?: number;
  /** Human readable explanation of how this was decided */
  note: string;
};

const V2_TRANSMITTER = "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64"; // same address on every EVM chain
const V1_TRANSMITTER: Record<number, string> = {
  0: "0x0a992d191DEeC32aFe36203Ad87D7d289a738F81",
  1: "0x8186359aF5F57FbB40c6b14A588d2A59C0C29880",
  2: "0x4D41f22c5a0e5c74090899E5a8Fb597a8842b3e8",
  3: "0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca",
  6: "0xAD09780d193884d503182aD4588450C416D6F9D4",
  7: "0xF3be9355363857F3e001be68856A2f96b4C39Ba9",
};

export const EVM_RPC: Record<number, string> = {
  0: "https://ethereum-rpc.publicnode.com",
  1: "https://avalanche-c-chain-rpc.publicnode.com",
  2: "https://optimism-rpc.publicnode.com",
  3: "https://arbitrum-one-rpc.publicnode.com",
  6: "https://base-rpc.publicnode.com",
  7: "https://polygon-bor-rpc.publicnode.com",
  10: "https://mainnet.unichain.org",
  11: "https://rpc.linea.build",
  12: "https://rpc.codex.xyz",
  13: "https://rpc.soniclabs.com",
  14: "https://worldchain-mainnet.g.alchemy.com/public",
  15: "https://rpc.monad.xyz",
  17: "https://bsc-rpc.publicnode.com",
  19: "https://rpc.hyperliquid.xyz/evm",
  21: "https://rpc-gel.inkonchain.com",
  33: "https://rpc.plasma.to",
  37: "https://rpc.xlayer.tech",
};

const SOLANA_RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
const SOLANA_MESSAGE_TRANSMITTER_V2 = "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC";
const STELLAR_MESSAGE_TRANSMITTER = "CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV";
const SOROBAN_RPC = "https://mainnet.sorobanrpc.com";
const TIMEOUT = 8000;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return fn();
  }
}

async function rpc<T>(url: string, method: string, params: unknown[] | Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(TIMEOUT),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

async function checkEvm(
  dstDomain: number,
  srcDomain: number,
  eventNonce: string,
  version: number
): Promise<MintCheck> {
  const url = EVM_RPC[dstDomain];
  if (!url) return { state: "unknown", note: "No public RPC is configured for this destination chain." };

  let to: string;
  let key: string;
  if (version === 2) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(eventNonce)) return { state: "unknown", note: "Unexpected nonce format." };
    to = V2_TRANSMITTER;
    key = eventNonce.slice(2);
  } else {
    const v1 = V1_TRANSMITTER[dstDomain];
    if (!v1 || !/^\d+$/.test(eventNonce)) {
      return { state: "unknown", note: "CCTP V1 mint checks are only supported on the original six chains." };
    }
    const buf = new Uint8Array(12);
    const view = new DataView(buf.buffer);
    view.setUint32(0, srcDomain);
    view.setBigUint64(4, BigInt(eventNonce));
    to = v1;
    key = bytesToHex(keccak256(buf));
  }

  const out = await rpc<string>(url, "eth_call", [{ to, data: `0xfeb61724${key}` }, "latest"]);
  if (out === "0x") return { state: "unknown", note: "The destination RPC returned no data." };
  const used = BigInt(out) === BigInt(1);
  return used
    ? { state: "minted", note: "The destination MessageTransmitter marks this nonce as used." }
    : { state: "pending", note: "The destination MessageTransmitter has not used this nonce yet." };
}

async function checkSolana(eventNonce: string, version: number): Promise<MintCheck> {
  if (version !== 2 || !/^0x[0-9a-fA-F]{64}$/.test(eventNonce)) {
    return { state: "unknown", note: "Only CCTP V2 mints can be checked on Solana." };
  }
  const pda = findProgramAddress(
    [new TextEncoder().encode("used_nonce"), hexToBytes(eventNonce)],
    SOLANA_MESSAGE_TRANSMITTER_V2
  );
  let lastError: unknown;
  for (const url of SOLANA_RPCS) {
    try {
      const acct = await rpc<{ value: { owner: string } | null }>(url, "getAccountInfo", [pda, { encoding: "base64" }]);
      if (!acct.value) return { state: "pending", note: "The used-nonce account does not exist on Solana yet." };
      const sigs = await rpc<{ signature: string; blockTime: number | null; err: unknown }[]>(
        url,
        "getSignaturesForAddress",
        [pda, { limit: 3 }]
      ).catch(() => []);
      const mint = sigs.filter((s) => !s.err).at(-1);
      return {
        state: "minted",
        txHash: mint?.signature,
        timestamp: mint?.blockTime ?? undefined,
        note: "The used-nonce account exists on Solana, so the message was received.",
      };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Solana RPC unavailable");
}

type ExpertEvent = { id: string; ts: number; bodyXdr?: string };

/**
 * Stellar does not expose nonces in its events, but the received message body is the same burn message
 * Circle returns, so match on that. Only recent events are searched.
 */
async function checkStellar(messageBody: string | null, sourceTs?: number): Promise<MintCheck> {
  if (!messageBody || !/^0x[0-9a-fA-F]+$/.test(messageBody)) {
    return { state: "unknown", note: "No message body to match against Stellar events." };
  }
  const needle = messageBody.slice(2).toLowerCase();
  let url: string | null =
    `https://api.stellar.expert/explorer/public/contract/${STELLAR_MESSAGE_TRANSMITTER}/events?limit=200&order=desc`;
  let oldest = Infinity;
  const deadline = Date.now() + 18_000;

  for (let page = 0; page < 5 && url && Date.now() < deadline; page++) {
    // Event pages are shared by every lookup, so a short cache makes repeat searches fast.
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT), next: { revalidate: 30 } });
    if (!res.ok) throw new Error(`Stellar Expert responded ${res.status}`);
    const json = (await res.json()) as {
      _embedded: { records: ExpertEvent[] };
      _links?: { next?: { href: string } };
    };
    for (const ev of json._embedded.records) {
      oldest = Math.min(oldest, ev.ts);
      if (ev.bodyXdr && Buffer.from(ev.bodyXdr, "base64").toString("hex").includes(needle)) {
        const ledger = Number(BigInt(ev.id.split("-")[0]) >> BigInt(32));
        const txHash = await sorobanTxHash(ledger, needle).catch(() => undefined);
        return {
          state: "minted",
          txHash,
          timestamp: ev.ts,
          note: "A message_received event on the Stellar MessageTransmitter carries this message.",
        };
      }
    }
    const next = json._links?.next?.href;
    url = next && json._embedded.records.length === 200 ? `https://api.stellar.expert${next}` : null;
  }

  // The search window reached back past the burn, so a missing event means the mint has not happened.
  if (sourceTs && oldest < sourceTs) {
    return { state: "pending", note: "No matching message_received event on Stellar since the burn." };
  }
  return { state: "unknown", note: "Not found in the most recent Stellar events, so the mint could not be confirmed." };
}

async function sorobanTxHash(ledger: number, needle: string): Promise<string | undefined> {
  const res = await rpc<{ events: { txHash: string; value: string }[] }>(SOROBAN_RPC, "getEvents", {
    startLedger: ledger,
    endLedger: ledger + 1,
    filters: [{ type: "contract", contractIds: [STELLAR_MESSAGE_TRANSMITTER] }],
    pagination: { limit: 100 },
  });
  return res.events.find((e) => Buffer.from(e.value, "base64").toString("hex").includes(needle))?.txHash;
}

export async function checkMint(args: {
  srcDomain: number;
  dstDomain: number;
  eventNonce: string;
  version: number;
  messageBody: string | null;
  sourceTs?: number;
}): Promise<MintCheck> {
  try {
    if (args.dstDomain === 5) return await checkSolana(args.eventNonce, args.version);
    if (args.dstDomain === 27) return await checkStellar(args.messageBody, args.sourceTs);
    if (EVM_RPC[args.dstDomain]) {
      return await checkEvm(args.dstDomain, args.srcDomain, args.eventNonce, args.version);
    }
    return { state: "unknown", note: "Mint checks are not available for this destination chain." };
  } catch (e) {
    return {
      state: "unknown",
      note: `The destination could not be queried (${e instanceof Error ? e.message : "error"}).`,
    };
  }
}

/* ---------- Source transaction facts ---------- */

export type SourceFacts = {
  timestamp?: number;
  sender?: string;
  rows: { label: string; value: string; mono?: boolean; copy?: boolean }[];
};

export async function fetchSourceFacts(srcDomain: number, txHash: string): Promise<SourceFacts> {
  return withRetry(() => fetchSourceFactsOnce(srcDomain, txHash)).catch(() => ({ rows: [] }));
}

async function fetchSourceFactsOnce(srcDomain: number, txHash: string): Promise<SourceFacts> {
  try {
    if (srcDomain === 27) {
      const res = await fetch(`${ENDPOINTS.horizon}/transactions/${txHash}`, {
        signal: AbortSignal.timeout(TIMEOUT),
        cache: "no-store",
      });
      if (res.status === 404) return { rows: [] };
      if (!res.ok) throw new Error(`Horizon responded ${res.status}`);
      const t = (await res.json()) as {
        created_at: string;
        ledger: number;
        source_account: string;
        fee_charged: string;
        operation_count: number;
        successful: boolean;
        memo?: string;
      };
      return {
        timestamp: Math.floor(Date.parse(t.created_at) / 1000),
        sender: t.source_account,
        rows: [
          { label: "Result", value: t.successful ? "Successful" : "Failed" },
          { label: "Ledger", value: String(t.ledger) },
          { label: "Fee paid", value: `${(Number(t.fee_charged) / 1e7).toFixed(7)} XLM` },
          { label: "Operations", value: String(t.operation_count) },
          ...(t.memo ? [{ label: "Memo", value: t.memo }] : []),
          { label: "Source account", value: t.source_account, mono: true, copy: true },
        ],
      };
    }
    const evm = EVM_RPC[srcDomain];
    if (evm) {
      const tx = await rpc<{ from: string; to: string; blockNumber: string } | null>(evm, "eth_getTransactionByHash", [txHash]);
      if (!tx) return { rows: [] };
      const block = await rpc<{ timestamp: string }>(evm, "eth_getBlockByNumber", [tx.blockNumber, false]);
      return {
        timestamp: Number(BigInt(block.timestamp)),
        sender: tx.from,
        rows: [
          { label: "Block", value: String(Number(BigInt(tx.blockNumber))) },
          { label: "From", value: tx.from, mono: true, copy: true },
          { label: "To", value: tx.to, mono: true, copy: true },
        ],
      };
    }
    if (srcDomain === 5) {
      for (const url of SOLANA_RPCS) {
        try {
          const tx = await rpc<{ blockTime: number | null; slot: number; meta: { fee: number } | null } | null>(
            url,
            "getTransaction",
            [txHash, { maxSupportedTransactionVersion: 0, encoding: "json" }]
          );
          if (!tx) return { rows: [] };
          return {
            timestamp: tx.blockTime ?? undefined,
            rows: [
              { label: "Slot", value: String(tx.slot) },
              ...(tx.meta ? [{ label: "Fee paid", value: `${(tx.meta.fee / 1e9).toFixed(9)} SOL` }] : []),
            ],
          };
        } catch {
          // try the next RPC
        }
      }
    }
  } catch (e) {
    throw e;
  }
  return { rows: [] };
}

