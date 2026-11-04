import { fetchRetry } from "@/lib/fetch";
import { ENDPOINTS, STELLAR_LZ_EID, chainByEid } from "@/lib/config";
import type {
  ChainRef,
  MetaRow,
  Diagnostic,
  Direction,
  PipelineStep,
  Transfer,
  TransferPage,
  TransferStatus,
  Verifier,
  VerifierState,
} from "@/lib/types";

type LzMessage = any;

const STALL_AFTER_SECONDS = 60 * 60;

function ref(eid: number): ChainRef {
  const c = chainByEid(eid);
  return { key: c.key, name: c.name, id: eid };
}

/** OFT payload = 32 byte recipient + 8 byte amountSD (6 decimals). Compose payloads are longer. */
function oftWireAmount(payload: string | undefined): string | null {
  if (!payload || !/^0x[0-9a-fA-F]+$/.test(payload)) return null;
  if (payload.length !== 2 + 80) return null;
  const amountHex = payload.slice(2 + 64);
  const units = BigInt(`0x${amountHex}`);
  const s = units.toString().padStart(7, "0");
  const whole = s.slice(0, -6);
  const frac = s.slice(-6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

function assetFor(msg: LzMessage): string | null {
  const id = msg.pathway?.sender?.id;
  const name = msg.pathway?.sender?.name;
  if (id === "usdt0") return "USDT0";
  if (id === "ethena") return "USDe";
  if (id && id !== "unknown") return name ?? id;
  return null;
}

function dvnState(s: string | undefined): VerifierState {
  switch (s) {
    case "SUCCEEDED":
      return "verified";
    case "VALIDATING_TX":
      return "verifying";
    case "FAILED":
      return "failed";
    default:
      return "waiting";
  }
}

function buildVerifiers(msg: LzMessage): {
  verifiers: Verifier[];
  quorum: { required: number; verified: number } | null;
} {
  const cfg = msg.config?.inboundConfig;
  const dvns: Record<string, any> = msg.verification?.dvn?.dvns ?? {};
  const names = new Map<string, string>();
  const requiredSet = new Set<string>();

  const register = (addrs: string[] = [], nms: string[] = [], required: boolean) => {
    addrs.forEach((a, i) => {
      const key = a.toLowerCase();
      names.set(key, nms[i] ?? a);
      if (required) requiredSet.add(key);
    });
  };
  register(cfg?.requiredDVNs, cfg?.requiredDVNNames, true);
  register(cfg?.optionalDVNs, cfg?.optionalDVNNames, false);

  const seen = new Set<string>();
  const verifiers: Verifier[] = [];

  for (const [addr, v] of Object.entries(dvns)) {
    const key = addr.toLowerCase();
    seen.add(key);
    verifiers.push({
      id: addr,
      name: names.get(key) ?? `${addr.slice(0, 8)}...`,
      state: dvnState(v?.status),
      timestamp: v?.blockTimestamp,
      txHash: v?.txHash,
    });
  }
  // Required DVNs that have not signed anything yet still belong in the quorum view.
  for (const key of requiredSet) {
    if (seen.has(key)) continue;
    verifiers.push({ id: key, name: names.get(key) ?? key, state: "waiting" });
  }

  if (!cfg || typeof cfg.requiredDVNCount !== "number") {
    return { verifiers, quorum: null };
  }
  const required = cfg.requiredDVNCount + (cfg.optionalDVNThreshold ?? 0);
  const verified = verifiers.filter((v) => v.state === "verified").length;
  return { verifiers, quorum: { required, verified: Math.min(verified, required) } };
}

function deriveStatus(
  msg: LzMessage,
  nowSeconds: number,
  srcTs: number
): TransferStatus {
  const name: string = msg.status?.name ?? "";
  const dest: string = msg.destination?.status ?? "";
  if (name === "DELIVERED") return "completed";
  if (
    ["FAILED", "BLOCKED", "APPLICATION_BURNED", "UNRESOLVABLE_COMMAND", "MALFORMED_COMMAND"].includes(
      name
    )
  ) {
    return "failed";
  }
  if (
    ["PAYLOAD_STORED", "APPLICATION_SKIPPED"].includes(name) ||
    ["PAYLOAD_STORED", "SIMULATION_REVERTED", "RESOLVED_PAYLOAD_SIZE_NOT_PAID", "FAILED"].includes(dest)
  ) {
    return "stalled";
  }
  const verified = msg.verification?.dvn?.status;
  const age = nowSeconds - srcTs;
  if (age > STALL_AFTER_SECONDS) return "stalled";
  if (verified === "SUCCEEDED" || verified === "QUORUM_REACHED" || msg.verification?.sealer?.status === "SUCCEEDED") {
    return "relaying";
  }
  return "attesting";
}

function buildPipeline(
  msg: LzMessage,
  status: TransferStatus,
  quorum: { required: number; verified: number } | null
): PipelineStep[] {
  const srcTx = msg.source?.tx;
  const dstTx = msg.destination?.tx;
  const dvnStatus: string = msg.verification?.dvn?.status ?? "WAITING";
  const sealerTx = msg.verification?.sealer?.tx;
  const lastDvnTs = Math.max(
    0,
    ...Object.values<any>(msg.verification?.dvn?.dvns ?? {}).map((d) => d.blockTimestamp ?? 0)
  );

  const sourceDone = msg.source?.status === "SUCCEEDED";
  const attestDone = dvnStatus === "SUCCEEDED" || dvnStatus === "QUORUM_REACHED";
  const relayDone = msg.destination?.status === "SUCCEEDED" || status === "completed";

  const failedAt: PipelineStep["key"] | null =
    status === "failed" || status === "stalled"
      ? !sourceDone
        ? "source"
        : !attestDone
          ? "attestation"
          : "relay"
      : null;

  const stateOf = (key: PipelineStep["key"], done: boolean, prevDone: boolean): PipelineStep["state"] => {
    if (done) return "done";
    if (failedAt === key) return status === "failed" ? "failed" : "active";
    return prevDone ? "active" : "pending";
  };

  return [
    {
      key: "source",
      label: "Source confirmed",
      state: stateOf("source", sourceDone, true),
      timestamp: srcTx?.blockTimestamp,
      txHash: srcTx?.txHash,
      detail: sourceDone ? "Packet emitted on the source chain" : "Waiting for source confirmations",
    },
    {
      key: "attestation",
      label: "DVN quorum",
      state: stateOf("attestation", attestDone, sourceDone),
      timestamp: attestDone ? lastDvnTs || sealerTx?.blockTimestamp : undefined,
      detail: quorum
        ? `${quorum.verified} of ${quorum.required} required verifiers signed`
        : "Waiting for verifiers",
    },
    {
      key: "relay",
      label: "Relayed and minted",
      state: stateOf("relay", relayDone, attestDone),
      timestamp: dstTx?.blockTimestamp,
      txHash: dstTx?.txHash,
      detail: relayDone
        ? "Executor delivered the message on the destination"
        : msg.destination?.status === "WAITING"
          ? "Waiting for executor"
          : `Destination status ${msg.destination?.status ?? "unknown"}`,
    },
    {
      key: "complete",
      label: "Completed",
      state: status === "completed" ? "done" : "pending",
      timestamp: status === "completed" ? dstTx?.blockTimestamp : undefined,
      detail: status === "completed" ? "Funds credited to the recipient" : undefined,
    },
  ];
}

function buildDiagnostics(
  msg: LzMessage,
  status: TransferStatus,
  direction: Direction,
  quorum: { required: number; verified: number } | null,
  nowSeconds: number,
  srcTs: number
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const dest: string = msg.destination?.status ?? "";
  const name: string = msg.status?.name ?? "";
  const toStellar = direction === "inbound";
  const ageMin = Math.round((nowSeconds - srcTs) / 60);

  if (name === "PAYLOAD_STORED" || dest === "PAYLOAD_STORED") {
    out.push({
      severity: "critical",
      title: "Payload stored, delivery blocked",
      detail:
        "The destination endpoint received the packet but lzReceive reverted, so the payload is stored and the path is blocked until it is retried or cleared. " +
        (toStellar
          ? "On Stellar common causes are a recipient without a trustline for the asset, or an expired contract entry (TTL) that needs restoring."
          : "Check the recipient contract on the destination chain."),
    });
  }
  if (dest === "SIMULATION_REVERTED") {
    out.push({
      severity: "critical",
      title: "Executor simulation reverted",
      detail: toStellar
        ? "The executor could not simulate lzReceive on Soroban, so it will not submit. Likely causes: missing trustline, archived or expired contract state (TTL), or too little gas in the executor options."
        : "The executor could not simulate lzReceive on the destination chain, so it will not submit.",
    });
  }
  if (dest === "RESOLVED_PAYLOAD_SIZE_NOT_PAID") {
    out.push({
      severity: "critical",
      title: "Payload size not paid",
      detail: "The message payload is larger than the executor fee covered. It needs a manual execution or a top-up.",
    });
  }
  if (["FAILED", "BLOCKED", "APPLICATION_BURNED", "UNRESOLVABLE_COMMAND", "MALFORMED_COMMAND"].includes(name)) {
    out.push({
      severity: "critical",
      title: `Message ${name.toLowerCase().replace(/_/g, " ")}`,
      detail: msg.status?.message ?? "LayerZero reports a terminal failure for this message.",
    });
  }
  if (status === "stalled" && !out.length) {
    out.push({
      severity: "warning",
      title: `No progress after ${ageMin} minutes`,
      detail: quorum
        ? `${quorum.verified} of ${quorum.required} required verifiers have signed. A single slow or offline verifier holds the whole message.`
        : "Verification has not completed. A slow or offline verifier holds the whole message.",
    });
  }
  if (status === "attesting" && quorum && quorum.verified < quorum.required) {
    out.push({
      severity: "info",
      title: "Waiting for verifiers",
      detail: `${quorum.verified} of ${quorum.required} required verifiers signed so far (${ageMin} min elapsed).`,
    });
  }
  if (status === "relaying") {
    out.push({
      severity: "info",
      title: "Verified, waiting for executor",
      detail: "All required verifiers signed. The executor still has to submit lzReceive on the destination.",
    });
  }
  if (msg.config?.error) {
    out.push({
      severity: "warning",
      title: "Pathway configuration error",
      detail: "LayerZero Scan could not resolve the ULN configuration for this pathway.",
    });
  }
  return out;
}

function buildMeta(msg: LzMessage, direction: Direction): MetaRow[] {
  const cfg = msg.config ?? {};
  const inbound = cfg.inboundConfig;
  const srcTx = msg.source?.tx ?? {};
  const rows: MetaRow[] = [{ label: "Protocol", value: "LayerZero V2" }];
  if (msg.pathway?.nonce !== undefined) rows.push({ label: "Nonce", value: String(msg.pathway.nonce) });
  if (msg.pathway?.sender?.name && msg.pathway.sender.name !== "unknown") {
    rows.push({ label: "Application", value: String(msg.pathway.sender.name) });
  }
  if (msg.pathway?.sender?.address) {
    rows.push({ label: "Sender contract", value: msg.pathway.sender.address, mono: true, copy: true });
  }
  if (srcTx.from) rows.push({ label: "Sent by wallet", value: srcTx.from, mono: true, copy: true });
  if (srcTx.blockNumber) rows.push({ label: "Source block", value: String(srcTx.blockNumber) });
  if (inbound?.confirmations !== undefined) {
    rows.push({ label: "Required confirmations", value: String(inbound.confirmations) });
  }
  if (inbound?.requiredDVNNames?.length) {
    rows.push({ label: "Required verifiers", value: inbound.requiredDVNNames.join(", ") });
  }
  const gas = srcTx.options?.lzReceive?.gas;
  if (gas) rows.push({ label: "Executor gas limit", value: Number(gas).toLocaleString() });
  if (cfg.outboundConfig?.executor) {
    rows.push({ label: "Executor", value: cfg.outboundConfig.executor, mono: true, copy: true });
  }
  if (cfg.ulnReceiveVersion) rows.push({ label: "Library version", value: String(cfg.ulnReceiveVersion) });
  if (msg.destination?.status) rows.push({ label: "Destination status", value: String(msg.destination.status) });
  if (direction === "outbound" || direction === "inbound") {
    rows.push({ label: "Packet GUID", value: msg.guid, mono: true, copy: true });
  }
  if (srcTx.payload) rows.push({ label: "Payload", value: srcTx.payload, mono: true, copy: true });
  return rows;
}

export function normalizeLzMessage(msg: LzMessage, nowSeconds = Math.floor(Date.now() / 1000)): Transfer {
  const srcEid: number = msg.pathway.srcEid;
  const dstEid: number = msg.pathway.dstEid;
  const direction: Direction =
    dstEid === STELLAR_LZ_EID ? "inbound" : srcEid === STELLAR_LZ_EID ? "outbound" : "other";

  const createdIso = msg.created ? Date.parse(msg.created) / 1000 : nowSeconds;
  const srcTs: number = msg.source?.tx?.blockTimestamp ?? createdIso;
  const dstTs: number | undefined = msg.destination?.tx?.blockTimestamp;
  const { verifiers, quorum } = buildVerifiers(msg);
  const wireAmount = oftWireAmount(msg.source?.tx?.payload);
  const status = deriveStatus(msg, nowSeconds, srcTs);
  const pipeline = buildPipeline(msg, status, quorum);

  return {
    id: msg.guid,
    protocol: "layerzero",
    direction,
    asset: assetFor(msg) ?? (wireAmount ? "OFT" : null),
    wireAmount,
    src: ref(srcEid),
    dst: ref(dstEid),
    sender: msg.pathway.sender?.address ?? "",
    receiver: msg.pathway.receiver?.address ?? "",
    srcTxHash: msg.source?.tx?.txHash ?? null,
    dstTxHash: msg.destination?.tx?.txHash ?? null,
    createdAt: srcTs,
    updatedAt: msg.updated ? Date.parse(msg.updated) / 1000 : srcTs,
    status,
    rawStatus: msg.status?.name ?? "UNKNOWN",
    statusMessage: msg.status?.message ?? "",
    latencySeconds: status === "completed" && dstTs ? Math.max(0, dstTs - srcTs) : null,
    pipeline,
    verifiers,
    verifierQuorum: quorum,
    diagnostics: buildDiagnostics(msg, status, direction, quorum, nowSeconds, srcTs),
    meta: buildMeta(msg, direction),
  };
}

const iso = (sec?: number) => (sec ? new Date(sec * 1000).toISOString() : undefined);

async function lzGet(path: string, params?: Record<string, string | number | undefined>) {
  const url = new URL(`${ENDPOINTS.layerzero}${path}`);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetchRetry(url, { next: { revalidate: 20 }, headers: { accept: "application/json" } });
  if (res.status === 404) return { data: [] as LzMessage[], nextToken: null };
  if (!res.ok) throw new Error(`LayerZero Scan responded ${res.status}`);
  return (await res.json()) as { data: LzMessage[]; nextToken?: string | null };
}

export type LzFeedParams = {
  direction?: "inbound" | "outbound" | "all";
  limit?: number;
  nextToken?: string;
  /** Unix seconds */
  start?: number;
  end?: number;
};

/** Messages that touch Stellar. "all" merges both directions by recency. */
export async function fetchLzFeed(p: LzFeedParams = {}): Promise<TransferPage> {
  const limit = Math.min(Math.max(p.limit ?? 25, 1), 100);
  const direction = p.direction ?? "all";
  const now = Math.floor(Date.now() / 1000);

  if (direction !== "all") {
    const r = await lzGet("/messages/latest", {
      limit,
      nextToken: p.nextToken,
      start: iso(p.start),
      end: iso(p.end),
      ...(direction === "inbound" ? { dstChainIds: STELLAR_LZ_EID } : { srcChainIds: STELLAR_LZ_EID }),
    });
    return { transfers: r.data.map((m) => normalizeLzMessage(m, now)), nextToken: r.nextToken ?? null };
  }

  // The upstream API cannot OR two chain filters, so fetch both directions and merge.
  let tokens: { in?: string; out?: string } = {};
  if (p.nextToken) {
    try {
      tokens = JSON.parse(Buffer.from(p.nextToken, "base64url").toString("utf8"));
    } catch {
      tokens = {};
    }
  }
  const [inb, outb] = await Promise.all([
    lzGet("/messages/latest", { limit, nextToken: tokens.in, dstChainIds: STELLAR_LZ_EID, start: iso(p.start), end: iso(p.end) }),
    lzGet("/messages/latest", { limit, nextToken: tokens.out, srcChainIds: STELLAR_LZ_EID, start: iso(p.start), end: iso(p.end) }),
  ]);
  const merged = [...inb.data, ...outb.data]
    .map((m) => normalizeLzMessage(m, now))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  // Both sides advance their own cursor, so return everything fetched (up to 2x limit) to avoid dropping rows.
  const next =
    inb.nextToken || outb.nextToken
      ? Buffer.from(JSON.stringify({ in: inb.nextToken ?? undefined, out: outb.nextToken ?? undefined })).toString("base64url")
      : null;
  return { transfers: merged, nextToken: next };
}

export async function fetchLzByGuid(guid: string): Promise<Transfer | null> {
  const r = await lzGet(`/messages/guid/${guid}`);
  return r.data[0] ? normalizeLzMessage(r.data[0]) : null;
}

export async function fetchLzByTx(hash: string): Promise<Transfer[]> {
  const r = await lzGet(`/messages/tx/${hash}`);
  const now = Math.floor(Date.now() / 1000);
  return r.data.map((m) => normalizeLzMessage(m, now));
}

export async function fetchLzByWallet(addr: string, limit = 25): Promise<Transfer[]> {
  const r = await lzGet(`/messages/wallet/${addr}`, { limit });
  const now = Math.floor(Date.now() / 1000);
  return r.data.map((m) => normalizeLzMessage(m, now));
}
