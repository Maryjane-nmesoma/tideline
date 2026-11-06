/**
 * Shapes of the third-party API responses Tideline reads, trimmed to the fields the adapters use.
 * Every field is optional unless the adapters cannot work without it, because these APIs are not ours and
 * change without notice. Normalizers must tolerate a missing field instead of assuming it.
 */

/* ---------- LayerZero Scan ---------- */

export interface LzTx {
  txHash?: string;
  blockTimestamp?: number;
  blockNumber?: number | string;
  from?: string;
  /** Hex OFT payload (32 byte recipient + 8 byte amount) */
  payload?: string;
  options?: { lzReceive?: { gas?: string | number } };
}

export interface LzDvn {
  status?: string;
  blockTimestamp?: number;
  txHash?: string;
}

export interface LzInboundConfig {
  confirmations?: number | string;
  requiredDVNs?: string[];
  requiredDVNNames?: string[];
  requiredDVNCount?: number;
  optionalDVNs?: string[];
  optionalDVNNames?: string[];
  optionalDVNThreshold?: number;
}

export interface LzMessage {
  guid: string;
  /** ISO 8601 */
  created?: string;
  updated?: string;
  pathway: {
    srcEid: number;
    dstEid: number;
    nonce?: number | string;
    sender?: { id?: string; name?: string; address?: string };
    receiver?: { address?: string };
  };
  source?: { status?: string; tx?: LzTx };
  destination?: { status?: string; tx?: LzTx };
  verification?: {
    dvn?: { status?: string; dvns?: Record<string, LzDvn> };
    sealer?: { status?: string; tx?: LzTx };
  };
  status?: { name?: string; message?: string };
  config?: {
    error?: unknown;
    ulnReceiveVersion?: string | number;
    inboundConfig?: LzInboundConfig;
    outboundConfig?: { executor?: string };
  };
}

/* ---------- Circle Iris ---------- */

export interface IrisDecodedBody {
  amount?: string;
  feeExecuted?: string;
  maxFee?: string;
  mintRecipient?: string;
  messageSender?: string;
  hookData?: string;
}

export interface IrisDecodedMessage {
  sourceDomain?: string | number;
  destinationDomain?: string | number;
  nonce?: string;
  sender?: string;
  recipient?: string;
  destinationCaller?: string;
  minFinalityThreshold?: string | number;
  finalityThresholdExecuted?: string | number;
  /** Hex of the whole CCTP message body, the same bytes the destination chain receives */
  messageBody?: string;
  decodedMessageBody?: IrisDecodedBody;
}

export interface IrisMessage {
  status?: string;
  cctpVersion?: string | number;
  eventNonce?: string;
  attestation?: string;
  message?: string;
  delayReason?: string;
  decodedMessage?: IrisDecodedMessage;
}

/* ---------- DefiLlama stablecoins ---------- */

/** Keyed by peg type, for example { peggedUSD: 123 } */
export type LlamaAmounts = Record<string, number | undefined>;

export interface LlamaChainCirculating {
  current?: LlamaAmounts;
  circulatingPrevDay?: LlamaAmounts;
  circulatingPrevWeek?: LlamaAmounts;
  circulatingPrevMonth?: LlamaAmounts;
}

export interface LlamaPeggedAsset {
  id: string | number;
  name: string;
  symbol: string;
  pegType: string;
  chainCirculating?: Record<string, LlamaChainCirculating | undefined>;
}

export interface LlamaChartRow {
  date: string | number;
  totalCirculatingUSD?: LlamaAmounts;
}

/* ---------- Stellar Expert ---------- */

export interface ExpertToml {
  orgName?: string;
  orgLogo?: string;
  issuer?: string;
  name?: string;
  desc?: string;
  image?: string;
  anchorAssetType?: string;
  anchorAsset?: string;
}

export interface ExpertAsset {
  /** "CODE-ISSUER-type", or "XLM" for the native asset */
  asset: string;
  code: string;
  domain?: string;
  contract?: string;
  /** Stroops */
  supply?: number | string;
  price?: number;
  payments?: number;
  trades?: number;
  trustlines?: { total?: number; authorized?: number; funded?: number };
  rating?: { average?: number };
  tomlInfo?: ExpertToml;
  toml?: ExpertToml;
}

export interface ExpertHistoryRow {
  ts: number | string;
  supply?: number | string;
  /** [total, authorized, funded] */
  trustlines?: number[];
  payments?: number;
}

export interface ExpertEvent {
  /** "<TOID>-<event index>" */
  id: string;
  /** Unix seconds */
  ts: number;
  bodyXdr?: string;
}

export interface ExpertEventPage {
  _embedded: { records: ExpertEvent[] };
  _links?: { next?: { href: string } };
}

/* ---------- SEP-6 / 24 / 31 ---------- */

export interface SepAssetDoc {
  enabled?: boolean;
  fee_fixed?: number;
  fee_percent?: number;
  min_amount?: number;
  max_amount?: number;
}

export type SepAssetMap = Record<string, SepAssetDoc | undefined>;

/** Response of GET <transfer server>/info */
export interface SepInfoDoc {
  deposit?: SepAssetMap;
  withdraw?: SepAssetMap;
  /** SEP-31 */
  receive?: SepAssetMap;
}
