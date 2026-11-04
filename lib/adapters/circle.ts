import { fetchRetry } from "@/lib/fetch";
import { CCTP_DOMAINS, ENDPOINTS, STELLAR_CCTP_DOMAIN, chainByDomain, type CctpDomain } from "@/lib/config";
import { checkMint, fetchSourceFacts, type MintCheck, type SourceFacts } from "@/lib/adapters/destination";
import type {
  ChainRef,
  Diagnostic,
  Direction,
  MetaRow,
  PipelineStep,
  Transfer,
  TransferStatus,
} from "@/lib/types";


const STALL_AFTER_SECONDS = 60 * 60;

function ref(domain: number): ChainRef {
  const c = chainByDomain(domain);
  return { key: c.key, name: c.name, id: domain };
}

/** CCTP burns are denominated in 6 decimal USDC base units. */
function usdc(units: string | undefined | null): string | null {
  if (!units || !/^\d+$/.test(units)) return null;
  const s = units.padStart(7, "0");
  const whole = s.slice(0, -6);
  const frac = s.slice(-6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export function cctpId(srcDomain: number, txHash: string, index: number) {
  return `cctp:${srcDomain}:${txHash}:${index}`;
}

export function parseCctpId(id: string) {
  const m = /^cctp:(\d+):([^:]+):(\d+)$/.exec(id);
  if (!m) return null;
  return { srcDomain: Number(m[1]), txHash: m[2], index: Number(m[3]) };
}

const finalityLabel = (v: string | undefined) =>
  v === "1000" ? "Fast (confirmed)" : v === "2000" ? "Standard (finalized)" : (v ?? "n/a");

function buildMeta(msg: any, facts: SourceFacts, mint: MintCheck | null, dstName: string): MetaRow[] {
  const dm = msg.decodedMessage ?? {};
  const body = dm.decodedMessageBody ?? {};
  const rows: MetaRow[] = [{ label: "Protocol", value: `Circle CCTP V${msg.cctpVersion ?? "?"}` }];

  if (dm.minFinalityThreshold) rows.push({ label: "Requested finality", value: finalityLabel(dm.minFinalityThreshold) });
  if (dm.finalityThresholdExecuted) {
    rows.push({ label: "Attested at finality", value: finalityLabel(dm.finalityThresholdExecuted) });
  }
  const fee = usdc(body.feeExecuted);
  const maxFee = usdc(body.maxFee);
  if (fee !== null) rows.push({ label: "Fee paid", value: `${fee} USDC` });
  if (maxFee !== null) rows.push({ label: "Max fee allowed", value: `${maxFee} USDC` });

  rows.push({ label: "Event nonce", value: String(msg.eventNonce ?? dm.nonce ?? "n/a"), mono: true, copy: true });
  if (body.mintRecipient) rows.push({ label: "Mint recipient", value: body.mintRecipient, mono: true, copy: true });
  if (dm.recipient) rows.push({ label: "Destination contract", value: dm.recipient, mono: true, copy: true });
  if (dm.destinationCaller) {
    const none = /^(0x0+|1{32,})$/.test(dm.destinationCaller);
    rows.push({ label: "Destination caller", value: none ? "Anyone can submit" : dm.destinationCaller, mono: !none, copy: !none });
  }
  if (body.hookData) rows.push({ label: "Hook data", value: body.hookData, mono: true, copy: true });

  rows.push(...facts.rows.map((r) => ({ ...r, label: `Source: ${r.label}` })));
  if (mint) rows.push({ label: `Mint check (${dstName})`, value: mint.note });
  if (msg.attestation && msg.attestation !== "PENDING") {
    rows.push({ label: "Attestation", value: msg.attestation, mono: true, copy: true });
  }
  if (msg.message && msg.message !== "0x") rows.push({ label: "Raw message", value: msg.message, mono: true, copy: true });
  return rows;
}

export function normalizeIrisMessage(
  msg: any,
  srcDomain: number,
  txHash: string,
  index: number,
  ctx: { facts: SourceFacts; mint: MintCheck | null } = { facts: { rows: [] }, mint: null },
  nowSeconds = Math.floor(Date.now() / 1000)
): Transfer {
  const dm = msg.decodedMessage ?? {};
  const body = dm.decodedMessageBody ?? {};
  const src = Number(dm.sourceDomain ?? srcDomain);
  const dst = Number(dm.destinationDomain ?? -1);
  const direction: Direction =
    dst === STELLAR_CCTP_DOMAIN ? "inbound" : src === STELLAR_CCTP_DOMAIN ? "outbound" : "other";
  const attested = msg.status === "complete";
  const { facts, mint } = ctx;
  const dstName = ref(dst).name;
  const burnTs = facts.timestamp;
  const mintTs = mint?.state === "minted" ? mint.timestamp : undefined;

  let status: TransferStatus;
  let statusMessage: string;
  if (!attested) {
    status = "attesting";
    statusMessage = "Waiting for Circle to attest the burn";
  } else if (mint?.state === "minted") {
    status = "completed";
    statusMessage = `Minted on ${dstName}`;
  } else if (mint?.state === "pending") {
    const age = burnTs ? nowSeconds - burnTs : 0;
    status = age > STALL_AFTER_SECONDS ? "stalled" : "relaying";
    statusMessage = `Attested, waiting for the mint on ${dstName}`;
  } else {
    status = "attested";
    statusMessage = `Attested. The mint on ${dstName} could not be checked.`;
  }

  const diagnostics: Diagnostic[] = [];
  if (msg.delayReason) {
    const reasons: Record<string, string> = {
      insufficient_fee: "The max fee on the burn is too low for Fast Transfer, so it waits for standard finality.",
      amount_above_max: "The burn amount exceeds the Fast Transfer allowance, so it waits for standard finality.",
      insufficient_allowance_available:
        "The burn amount exceeds the remaining Fast Transfer allowance, so it waits for standard finality.",
    };
    diagnostics.push({
      severity: "warning",
      title: `Delayed: ${String(msg.delayReason).replace(/_/g, " ")}`,
      detail: reasons[msg.delayReason] ?? "Circle reports a delay for this transfer.",
    });
  }
  if (status === "stalled") {
    diagnostics.push({
      severity: "critical",
      title: `Attested ${Math.round((nowSeconds - (burnTs ?? nowSeconds)) / 60)} minutes ago, still not minted`,
      detail:
        dst === STELLAR_CCTP_DOMAIN
          ? "Nobody has called receive_message on Stellar. If the burn set a destination caller, only that address can mint; otherwise anyone can submit the attestation through the CctpForwarder."
          : "Nobody has called receiveMessage on the destination. If the burn set a destination caller, only that address can mint; otherwise anyone can submit the attestation.",
    });
  } else if (status === "relaying") {
    diagnostics.push({
      severity: "info",
      title: "Attested, waiting for the mint",
      detail: "Circle signed the burn. The mint still needs a receiveMessage call on the destination, usually made by a relayer or forwarder.",
    });
  } else if (status === "attested") {
    diagnostics.push({
      severity: "info",
      title: "Attestation ready, mint not verified",
      detail: mint?.note ?? "Circle has signed the burn, but Iris does not report the mint and this destination could not be checked.",
    });
  }

  const pipeline: PipelineStep[] = [
    {
      key: "source",
      label: "Burn confirmed",
      state: "done",
      txHash,
      timestamp: burnTs,
      detail: `USDC burned on ${ref(src).name}`,
    },
    {
      key: "attestation",
      label: "Circle attestation",
      state: attested ? "done" : "active",
      detail: attested
        ? `Signed at ${finalityLabel(dm.finalityThresholdExecuted ?? dm.minFinalityThreshold).toLowerCase()} finality`
        : "Waiting for Circle to attest the burn",
    },
    {
      key: "relay",
      label: "Minted on destination",
      state: !attested ? "pending" : mint?.state === "minted" ? "done" : mint?.state === "pending" ? "active" : "pending",
      txHash: mint?.state === "minted" ? mint.txHash : undefined,
      timestamp: mintTs,
      detail: !attested
        ? undefined
        : mint?.state === "minted"
          ? `Minted on ${dstName}`
          : mint?.state === "pending"
            ? "Waiting for receiveMessage"
            : "Not verifiable from here",
    },
    {
      key: "complete",
      label: "Completed",
      state: status === "completed" ? "done" : "pending",
      timestamp: status === "completed" ? mintTs : undefined,
    },
  ];

  const sender = body.messageSender ?? dm.sender ?? facts.sender ?? "";

  return {
    id: cctpId(srcDomain, txHash, index),
    protocol: "cctp",
    direction,
    asset: "USDC",
    wireAmount: usdc(body.amount),
    src: ref(src),
    dst: ref(dst),
    sender,
    receiver: body.mintRecipient ?? dm.recipient ?? "",
    srcTxHash: txHash,
    dstTxHash: mint?.state === "minted" ? (mint.txHash ?? null) : null,
    createdAt: burnTs ?? null,
    updatedAt: mintTs ?? burnTs ?? null,
    status,
    rawStatus: msg.status ?? "unknown",
    statusMessage,
    latencySeconds: burnTs && mintTs ? Math.max(0, mintTs - burnTs) : null,
    pipeline,
    verifiers: [],
    verifierQuorum: null,
    diagnostics,
    meta: buildMeta(msg, facts, mint, dstName),
  };
}

async function irisMessages(domain: number, txHash: string): Promise<Transfer[]> {
  const url = `${ENDPOINTS.iris}/messages/${domain}?transactionHash=${encodeURIComponent(txHash)}`;
  const res = await fetchRetry(url, { next: { revalidate: 15 }, headers: { accept: "application/json" } });
  if (res.status === 404 || res.status === 400) return [];
  if (!res.ok) throw new Error(`Circle Iris responded ${res.status}`);
  const json = (await res.json()) as { messages?: any[] };
  const messages = json.messages ?? [];
  if (messages.length === 0) return [];

  // Source details are shared by every message in the transaction; fetch them once.
  const facts = await fetchSourceFacts(domain, txHash);
  return Promise.all(
    messages.map(async (m, i) => {
      const dm = m.decodedMessage ?? {};
      const mint =
        m.status === "complete" && dm.destinationDomain !== undefined
          ? await checkMint({
              srcDomain: Number(dm.sourceDomain ?? domain),
              dstDomain: Number(dm.destinationDomain),
              eventNonce: String(m.eventNonce ?? dm.nonce ?? ""),
              version: Number(m.cctpVersion ?? 2),
              messageBody: dm.messageBody ?? null,
              sourceTs: facts.timestamp,
            })
          : null;
      return normalizeIrisMessage(m, domain, txHash, i, { facts, mint });
    })
  );
}

export type CctpLookup = { transfers: Transfer[]; probed: number; failed: number };

/**
 * A hash does not say which chain it came from, so probe every CCTP source domain that uses that hash format.
 * Failed probes are counted instead of swallowed so the caller can say the answer is incomplete.
 */
export async function fetchCctpByTx(txHash: string, kind: CctpDomain["kind"]): Promise<CctpLookup> {
  const domains = CCTP_DOMAINS.filter((d) => d.kind === kind).map((d) => d.domain);
  const results = await Promise.allSettled(domains.map((d) => irisMessages(d, txHash)));
  const transfers = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failed = results.filter((r) => r.status === "rejected").length;
  return { transfers, probed: domains.length, failed };
}

export async function fetchCctpById(id: string): Promise<Transfer | null> {
  const p = parseCctpId(id);
  if (!p) return null;
  const all = await irisMessages(p.srcDomain, p.txHash);
  return all[p.index] ?? null;
}

export type FeeQuote = { finalityThreshold: number; minimumFee: number };

export async function fetchCctpFees(srcDomain: number, dstDomain: number): Promise<FeeQuote[]> {
  const res = await fetchRetry(`${ENDPOINTS.iris}/burn/USDC/fees/${srcDomain}/${dstDomain}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Circle Iris fees responded ${res.status}`);
  return (await res.json()) as FeeQuote[];
}
