# Milestones

What is left to build, in the order that makes sense to build it. Each milestone is sized so that a contributor can
pick it up, and each lists what "done" means so a pull request can be judged against it.

Shipped work is recorded in [`CHANGELOG.md`](CHANGELOG.md). Product scope and the longer-term plan are in
[`docs/PRD.md`](docs/PRD.md). Before starting anything here, read [`CONTRIBUTING.md`](CONTRIBUTING.md) and open an
issue (or comment on the existing one) so two people do not build the same thing.

| # | Milestone | Size | Good first issue? |
|---|---|---|---|
| M1 | [Browsable CCTP feed](#m1-browsable-cctp-feed) | Large | No. Split it into the parts below |
| M2 | [Mint checks for Sui, Aptos, Starknet and Noble](#m2-mint-checks-for-sui-aptos-starknet-and-noble) | Small per chain | Yes, one chain per pull request |
| M3 | [Allbridge Core](#m3-allbridge-core) | Medium | Partly |

The ground rules in the README apply to all of them: **live data only, no mock fallbacks, and a source that cannot be
reached is reported as unreachable rather than guessed.**

---

## M1. Browsable CCTP feed

**Problem.** Circle publishes no list of transfers, only lookups by burn transaction. So `/transfers/cctp` can show a
CCTP transfer only after someone pastes its burn hash, while LayerZero has a full browsable feed. The overview and the
"all transfers" page therefore undercount Stellar's real cross-chain activity.

**Goal.** A feed of recent CCTP transfers that touch Stellar, in both directions, sitting next to the LayerZero feed
and using the same `Transfer` shape and status logic.

**Where the data can come from.** These are starting points, not decisions. The first task is to confirm each one
works and write the result down in `docs/DATA-SOURCES.md`.

| Direction | Source | What to confirm |
|---|---|---|
| Into Stellar | `message_received` events on the Stellar MessageTransmitter, read from Stellar Expert (the mint check in `lib/adapters/destination.ts` already pages through these) | The event body is the CCTP message, so it carries the source domain and nonce. Check whether Iris can look a message up from those without the source transaction hash. If it cannot, the source hash has to come from the source chain |
| Out of Stellar | `deposit_for_burn` events on the Stellar TokenMessenger | The contract id and event shape. The burn transaction hash is then enough for the existing Iris lookup |
| Into Stellar, from EVM | `DepositForBurn` logs on each EVM TokenMessenger where the destination domain is Stellar's | Public RPCs limit `eth_getLogs` ranges and are rate limited. Measure before committing to this |

**Suggested split** (open one issue per line):

1. Research note: which sources work, with example requests and responses, added to `docs/DATA-SOURCES.md`.
2. Outbound feed from Stellar burns.
3. Inbound feed from Stellar mints, resolving each to its burn through Iris.
4. Merge into `/api/transfers` and the transfers pages, with a protocol filter and pagination.
5. Include CCTP in the overview counts, the daily chart and the routes heatmap.

**Done when**

- The feed lists real CCTP transfers from the last 7 days, newest first, for both directions.
- Every row uses the existing normalizer, so statuses match what the detail page shows.
- A source outage degrades to a visible "CCTP feed unavailable" state and the LayerZero feed still loads.
- Responses are cached so opening the page does not fan out dozens of upstream calls.
- Unit tests cover the new normalization with fixtures, and a live test (`tests/live`) covers the real source.
- The "no public feed" entry is removed from the README's known limits.

**Out of scope.** Storing history in a database. Tideline stays stateless.

---

## M2. Mint checks for Sui, Aptos, Starknet and Noble

**Problem.** Tideline confirms a CCTP mint by asking the destination chain. That works for the 17 EVM chains,
Solana and Stellar. For burns that go to Sui, Aptos, Starknet or Noble the transfer stops at **Attested** because the
mint cannot be checked, which is a weaker answer than the product promises.

**Goal.** Move a transfer to **Completed** (with the mint transaction and time where the chain gives them) or
**Relaying** only when that chain confirms it.

**How to approach one chain.**

1. Confirm the chain has CCTP V2 and find its MessageTransmitter (or equivalent) and a public RPC with no API key.
2. Find how the chain records "this message was received": a used-nonce table, a used-nonce account, an event, or a
   module query. Write down the exact call.
3. Add a `checkX()` function beside `checkSolana` and `checkStellar` in `lib/adapters/destination.ts`, and route to it
   from `checkMint` by destination domain. Add the RPC endpoint to `lib/config.ts`.
4. Return `minted`, `pending` or `unknown` per the rules below.
5. Add unit tests with recorded fixtures, a live test in `tests/live`, and a row in the README and `docs/DATA-SOURCES.md`
   mint tables.

**Rules for the result.**

- `minted` only when the chain says the message was received.
- `pending` only when the chain was reached and proves it has not been received. A failed or timed out call is
  `unknown`, never `pending`.
- Do not guess from timing. Do not mark a transfer completed because Circle attested it.

**One pull request per chain.** They are independent.

| Chain | CCTP domain (`lib/config.ts`) | Notes to verify first |
|---|---|---|
| Sui | 8 | Whether the used-nonce record can be read without the full object id of a shared object |
| Aptos | 9 | Whether received messages are exposed through a view function or a table handle |
| Starknet | 25 | Whether a call or an event filter is the cheaper check on public RPCs |
| Noble | 4 | Noble is a Cosmos chain with a native CCTP module. Look for a used-nonce query on its REST or gRPC gateway |

**Done when** a real attested transfer to that chain shows **Completed** with the mint transaction, a real unminted one
shows **Relaying**, and an unreachable RPC shows **Attested** with a note saying so.

---

## M3. Allbridge Core

**Problem.** Allbridge Core is a major route into Stellar, but it has no public hosted API. Its REST API is offered
only as a service you run yourself. Tideline therefore lists it as unavailable on the overview.

**Goal.** Show Allbridge transfers wherever an Allbridge source is configured, and keep today's honest
"unavailable" state wherever one is not.

**Options.**

| Option | Trade-off |
|---|---|
| Optional self-hosted REST endpoint, set by an environment variable | Smallest change and consistent with "no keys needed by default". Operators who want Allbridge run the service |
| Read Allbridge contract events on Stellar and EVM directly | No extra service, but more chain-specific code and the same RPC limits as M1 |
| A hosted API, if Allbridge ever publishes one | Preferred if it appears. Revisit this milestone then |

**Done when**

- Without configuration, nothing changes: Allbridge still shows as unavailable and the app needs no keys.
- With the endpoint set, Allbridge transfers appear in the feed, search, the detail page and the source health panel,
  using the existing `Transfer` shape.
- The environment variable is documented in the README and a `.env.example` file.
- Unit tests cover the normalizer with fixtures. A live test is optional and skipped unless the variable is set.

---

## Later

The Phase 2 items in [`docs/PRD.md`](docs/PRD.md) (rescue console, preflight simulator, SEP-24 and SEP-31 tracking,
alerts) come after the milestones above. Open a discussion before starting any of them. The rescue console in
particular signs transactions, so it needs a design review first.
