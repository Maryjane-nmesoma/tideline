<p align="center">
  <img src="public/logo.svg" alt="Tideline" width="72" height="72">
</p>

<h1 align="center">Tideline</h1>

<p align="center">
  Cross-chain intelligence and explorer for Stellar.<br>
  Track Circle CCTP and LayerZero transfers, see why one is stuck, and explore the institutions behind Stellar's assets.
</p>

<p align="center">
  <a href="https://tideline-opal.vercel.app"><strong>Live demo: tideline-opal.vercel.app</strong></a>
</p>

---

Cross-chain tooling on Stellar is split across vendor explorers that each show only their own leg. Tideline puts
them behind one search box and answers the question those explorers don't: **where is my transfer, and why is it
slow?**

Everything on screen is read live from public APIs and chains. There is no mock data and no database. When a
source is down, the page says so instead of inventing numbers.

## What it does

| Page | Route | What you get |
|---|---|---|
| Overview | `/` | 24h and 7d transfer counts, median delivery time, stalled count, Stellar stablecoin supply, a 30 day chart, source health, live feed |
| All transfers | `/transfers` | Headline stats, daily transfers chart (7D or 30D), share by chain, then every LayerZero transfer touching Stellar with universal search and filters |
| LayerZero | `/transfers/layerzero` | The above plus delivery time distribution, volume by route and a route latency heatmap |
| Circle CCTP | `/transfers/cctp` | USDC supply on Stellar over time, USDC supply by chain, fee chart, a burn transaction search, and fee quotes in both directions |
| Transfer details | `/transfers/[id]` | Pipeline, diagnostic autopsy, verifier quorum, decimal check, and raw protocol details |
| Corridors | `/corridors` | The financial institutions on Stellar: holders ranking and share, fiat currencies covered, asset types, full table |
| Institution | `/corridors/[slug]` | Per-asset supply, holders and daily payments history, share of holders by asset, Soroban contracts, and live on and off ramps (SEP-6, 24, 31) |
| Liquidity | `/liquidity` | Total stablecoin supply on Stellar, share by asset, per-asset change |
| Dust calculator | `/tools/dust-calc` | Exact 7 to 6 decimal conversion and what stays behind |

### Universal search

Paste any of these into the navbar or the transfers page:

- an EVM transaction hash, or a LayerZero GUID
- a Stellar transaction hash (64 hex characters, no `0x`)
- a Solana signature or a Sui transaction digest
- a Stellar `G...` account or `C...` contract address

Circle and LayerZero index the **source** transaction (the burn or the send). A mint or receive transaction on the
destination chain will not match, so search the source one.

### Transfer status

| Status | Meaning |
|---|---|
| Completed | Delivered. For CCTP this is confirmed on the destination chain, not assumed |
| Attested | Circle signed the burn, but the mint could not be checked on that destination |
| Attesting | Waiting for Circle or for LayerZero verifiers to sign |
| Relaying | Verified or attested, waiting for the destination execution or mint |
| Stalled | No progress after 60 minutes, or a LayerZero payload is stored or its simulation reverted |
| Failed | A terminal LayerZero failure |

## Quick start

Requires Node 20.9 or newer and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

No environment variables or API keys are needed.

```bash
pnpm build        # production build
pnpm start        # serve the build
pnpm lint
pnpm typecheck
pnpm test         # unit tests, no network
pnpm test:live    # tests against the real public APIs (slow, needs network)
```

The first page load in dev compiles routes on demand and can take 20 to 30 seconds. To build or run a second copy
without disturbing a running `next dev`, point it at its own output folder:

```bash
NEXT_DIST_DIR=.next-check pnpm build
```

## How it works

```
Browser (React Query)  ->  /api/* route handlers  ->  public APIs and chains
                              lib/adapters/*              LayerZero Scan, Circle Iris,
                              normalize to Transfer       Stellar Expert, Horizon, Soroban RPC,
                                                          DefiLlama, EVM and Solana RPCs
```

- **Adapters** (`lib/adapters`) turn each upstream response into one `Transfer` shape (`lib/types.ts`): a pipeline of
  steps, verifiers, diagnostics, and a list of protocol details.
- **API routes** (`app/api`) are thin. They exist so the browser never talks to the upstreams directly and so
  responses can be cached briefly.
- **Hooks** (`hooks/use-api.ts`) fetch with React Query. Transfers are hydrated with default empty lists so an old
  cached payload can never crash a page.
- **Failures are visible.** Every panel has loading, empty and error states, and the overview shows which data
  sources are reachable.

### Verifying a CCTP mint

Circle's API only says a burn was **attested**. It never says the mint happened. Tideline asks the destination chain:

| Destination | How it checks |
|---|---|
| 17 EVM chains | Reads `usedNonces` on the destination MessageTransmitter (V2, and V1 on the original six chains) |
| Solana | Looks for the program's used-nonce account and reads its first signature as the mint transaction |
| Stellar | Finds the ledger of the burn from its timestamp, then reads the Stellar MessageTransmitter's `message_received` events forward from there and matches the burn message. Works for transfers of any age. Reaching the newest event without a match proves the mint has not happened |
| Sui, Aptos, Starknet, Noble | Not checkable here, so the transfer shows as **Attested** |

### Dust

Stellar tokens have 7 decimals and the bridges carry 6. Circle CCTP and LayerZero remove the sub-6-decimal remainder
**before** debiting, so it is not burned: it stays in the sender's account and never crosses. The calculator and the
transfer page use exact BigInt math, checked against Python's `Decimal` on 20,000 random amounts.

## Project layout

```
app/
  api/                 route handlers (transfers, search, stats, routes, institutions, cctp-fees, ...)
  transfers/           explorer, LayerZero, CCTP, transfer details
  corridors/           institutions and institution details
  liquidity/  tools/dust-calc/
components/            feature components; ui/ holds the shadcn primitives, sidebar and navbar
hooks/use-api.ts       every client data hook
lib/
  adapters/            layerzero, circle, destination (mint checks), sep, stellar-expert, defillama
  config.ts            chain ids, CCTP domains, endpoints
  dust.ts  keccak.ts  solana.ts  stellar.ts  stellar-time.ts   pure helpers with no network access
  search.ts            query classification and routing
  types.ts             the app's own models (Transfer, SepInfo, ...)
  upstream.ts          types for the third-party API responses the adapters read
tests/                 unit tests (pnpm test); tests/live hits the real APIs (pnpm test:live)
docs/                  product requirements and data source notes
public/logo.svg
```

## Known limits

- **CCTP has no public feed.** Circle publishes no list of transfers, so CCTP transfers appear only when you search
  a burn transaction. The LayerZero feed is the only browsable one. Planned: [M1](MILESTONE.md#m1-browsable-cctp-feed).
- **Mint checks do not cover Sui, Aptos, Starknet or Noble.** Transfers to those chains stop at Attested. Planned:
  [M2](MILESTONE.md#m2-mint-checks-for-sui-aptos-starknet-and-noble).
- **Allbridge Core is not integrated.** It has no public hosted API, only a self-hosted REST service. The overview
  lists it as unavailable. Planned: [M3](MILESTONE.md#m3-allbridge-core).
- **Bridge pool reserves are not public.** The liquidity page shows total stablecoin supply on Stellar instead, which
  is the closest observable signal of a float problem.
- **Institution market values are estimates** (supply times last traded price) and unreliable for thin tokens, so
  institutions are ranked by holders.
- **Stellar volume is low.** The 24 hour cards are often single digits. That is the real traffic.
- The public RPCs and APIs are rate limited and sometimes slow. A first CCTP lookup can take 10 to 30 seconds.

## Stack

Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, shadcn/ui and Radix primitives,
TanStack Query v5, Recharts, next-themes, lucide-react, Vitest. The layout and design tokens follow the sui-dashboard
template.

## Docs

- [`docs/PRD.md`](docs/PRD.md): product scope, what shipped and what is next
- [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md): every upstream, the identifiers used, and the gotchas found
- [`MILESTONE.md`](MILESTONE.md): what is left to build, with a definition of done for each item
- [`CHANGELOG.md`](CHANGELOG.md): what changed in each version

## Contributing

Contributions are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, the project's principles and how
to add an adapter, then pick something from [`MILESTONE.md`](MILESTONE.md) or the issues labelled `good first issue`.
Please read the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately, as described in
[`SECURITY.md`](SECURITY.md).

## License

[MIT](LICENSE)
