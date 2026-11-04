# Tideline: Product Requirements

**Status:** Phase 1 shipped. Phase 2 not started.

## 1. Problem

Cross-chain activity into and out of Stellar is growing through **Circle CCTP** (native USDC), **LayerZero OFT**
(USDT0), Allbridge, and SEP-24 and SEP-31 anchors. The tooling around it is fragmented:

1. **Siloed explorers.** LayerZero Scan, Circle Iris and each anchor show only their own leg.
2. **Silent friction.** Transfers hang with no explanation: slow verifiers, a stored payload, a missing trustline, an
   expired contract entry, or a 7 versus 6 decimal mismatch.
3. **No float visibility.** Nobody can see whether stablecoin supply on Stellar is moving.

Tideline is one place to search any transfer, see where it is in its pipeline, understand why it is stuck, and see who
the institutions on Stellar are.

## 2. Users

- **Traders and cross-chain users** who want one search box and a plain answer to "where is my money".
- **Protocol engineers** building on Soroban who need to check decimals, destinations and attestation state.
- **Operators and analysts** watching delivery times, stalls and stablecoin supply.

## 3. Principles

- **Live data only.** No mock data, no seeded numbers. If a source fails the page says so.
- **Verify, do not assume.** A CCTP transfer is Completed only when the destination chain confirms the mint.
- **Be honest about limits.** Missing data is labeled, not hidden or estimated silently.

## 4. Phase 1 (shipped)

| Area | Delivered |
|---|---|
| Multi-rail feed | LayerZero feed; CCTP by burn transaction search. Allbridge shown as unavailable |
| Universal search | EVM, Stellar, Solana and Sui hashes, LayerZero GUIDs, G and C addresses |
| Overview | Transfer counts, delivery time, stalled count, stablecoin supply, 30 day chart, source health, live feed |
| Transfer details | Pipeline, diagnostic autopsy, verifier quorum, dust check, raw protocol details |
| CCTP mint verification | EVM (17 chains), Solana, Stellar. Others reported as Attested |
| Routes | Latency heatmap and volume by route, from LayerZero data |
| Corridors | Financial institutions on Stellar, with assets, holders, contracts and live SEP ramp info |
| Liquidity | Total stablecoin supply, history, share by asset |
| Dust calculator | Exact 7 to 6 decimal conversion in both directions |

### Changes from the original plan

- **Corridors are institutions, not chain pairs.** The first draft treated a corridor as a source and destination chain.
  On Stellar the meaningful corridor is the institution (Circle, Anclap, Etherfuse and so on) that moves value in and
  out. The chain-pair latency view moved to the LayerZero page as "routes".
- **No mock data.** The original plan allowed mock fallbacks. Live only was chosen instead.
- **Float monitoring is supply-level.** Per-bridge pool reserves are not exposed by any public API, so the liquidity
  page tracks total stablecoin supply on Stellar.
- **Dust is not "lost".** Both CCTP and LayerZero remove the remainder before debiting, so it stays with the sender.
  The tool reports what will not cross rather than what is lost.

## 5. Phase 2 (next)

- **Rescue console.** Connect Freighter or MetaMask and submit a pending attestation to the destination when a relayer
  stalls. CCTP's destination caller rules decide who may do this.
- **Preflight simulator.** Check a recipient trustline, contract TTL and post-dust amount before sending.
- **Full Stellar mint history.** Index `message_received` events beyond the recent window so older inbound CCTP
  transfers resolve to Completed.
- **More destinations for mint checks** (Sui, Aptos, Starknet).
- **SEP-24 and SEP-31 transfer tracking** for fiat settlement (PIX, SPEI, SEPA), building on the institution ramp data.
- **Allbridge**, if a public API appears or a self-hosted instance is configured.
- **Alerts** for stalled transfers and stablecoin supply drops.

## 6. Non-goals

- Executing or signing transfers (until the rescue console).
- Financial advice or price predictions.
- Storing user data. The app has no database or accounts.

## 7. Success measures

- A user can paste any burn or send transaction and see a correct status in under 30 seconds.
- A stuck transfer shows a specific, accurate reason rather than a generic "pending".
- No page crashes when an upstream is slow or returns an old or partial payload.
