export type Protocol = "layerzero" | "cctp" | "allbridge";
export type Direction = "inbound" | "outbound" | "other";
export type TransferStatus =
  | "completed"
  | "attested"
  | "attesting"
  | "relaying"
  | "stalled"
  | "failed";

export type ChainRef = { key: string; name: string; id: number };

export type PipelineStepState = "done" | "active" | "pending" | "failed";

export type PipelineStep = {
  key: "source" | "attestation" | "relay" | "complete";
  label: string;
  state: PipelineStepState;
  /** Unix seconds */
  timestamp?: number;
  detail?: string;
  txHash?: string;
};

export type VerifierState = "waiting" | "verifying" | "verified" | "failed";

export type Verifier = {
  id: string;
  name: string;
  state: VerifierState;
  timestamp?: number;
  txHash?: string;
};

export type MetaRow = {
  label: string;
  value: string;
  /** Render in a monospace font */
  mono?: boolean;
  /** Offer a copy button */
  copy?: boolean;
  href?: string;
};

export type Diagnostic = {
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
};

export type Transfer = {
  /** Route id: LayerZero GUID, or `cctp:<srcDomain>:<txHash>:<index>` */
  id: string;
  protocol: Protocol;
  direction: Direction;
  asset: string | null;
  /** Amount crossing the wire in 6-decimal units, as a decimal string. null when not decodable. */
  wireAmount: string | null;
  src: ChainRef;
  dst: ChainRef;
  sender: string;
  receiver: string;
  srcTxHash: string | null;
  dstTxHash: string | null;
  /** Unix seconds */
  createdAt: number | null;
  updatedAt: number | null;
  status: TransferStatus;
  rawStatus: string;
  statusMessage: string;
  /** End-to-end seconds when delivered */
  latencySeconds: number | null;
  pipeline: PipelineStep[];
  verifiers: Verifier[];
  verifierQuorum: { required: number; verified: number } | null;
  diagnostics: Diagnostic[];
  /** Protocol and source transaction facts shown in the details view */
  meta: MetaRow[];
};

export type TransferPage = {
  transfers: Transfer[];
  nextToken: string | null;
};

export type SourceHealth = {
  source: string;
  ok: boolean;
  message?: string;
};

export type CorridorStat = {
  key: string;
  from: ChainRef;
  to: ChainRef;
  count: number;
  completed: number;
  stalled: number;
  medianLatencySeconds: number | null;
  p90LatencySeconds: number | null;
};

export type SupplyPoint = { date: number; usd: number };

export type StellarAssetSupply = {
  id: string;
  name: string;
  symbol: string;
  pegType: string;
  circulatingUsd: number;
  prevDayUsd: number;
  prevWeekUsd: number;
  prevMonthUsd: number;
};

export type InstitutionAsset = {
  code: string;
  issuer: string;
  /** Soroban Stellar Asset Contract id */
  contract: string | null;
  name: string | null;
  description: string | null;
  /** fiat, crypto, nft... as declared in the issuer's stellar.toml */
  assetType: string | null;
  /** What it is pegged to, e.g. USD, EUR, ARS */
  anchorAsset: string | null;
  image: string | null;
  supply: number;
  priceUsd: number | null;
  valueUsd: number;
  holders: number;
  fundedHolders: number;
  payments: number;
  trades: number;
  rating: number | null;
};

export type Institution = {
  slug: string;
  name: string;
  legalName: string;
  domain: string | null;
  logo: string | null;
  assets: InstitutionAsset[];
  /** Market value estimate: supply x last market price. Unreliable for illiquid tokens. */
  valueUsd: number;
  holders: number;
  payments: number;
  /** Fiat currencies or real-world assets its tokens represent, e.g. USD, ARS, CETES */
  currencies: string[];
};

export type SepAmountRule = {
  asset: string;
  enabled: boolean;
  feeFixed: number | null;
  feePercent: number | null;
  min: number | null;
  max: number | null;
};

export type SepService = "sep6" | "sep24" | "sep31";

export type SepInfo = {
  domain: string;
  /** True only when the anchor lists the server in stellar.toml and its /info answered */
  services: Record<SepService, boolean>;
  /** Servers the anchor lists but that did not answer. They are neither offered nor known to be absent. */
  unreachable: SepService[];
  deposit: SepAmountRule[];
  withdraw: SepAmountRule[];
  /** SEP-31 cross-border payments the institution can receive */
  receive: SepAmountRule[];
};

export type AssetHistoryPoint = {
  /** Unix seconds, start of day */
  date: number;
  supply: number;
  holders: number;
  payments: number;
};

export type ShareItem = { name: string; value: number };
