# Contributing to Tideline

Thanks for helping. Tideline is a cross-chain explorer for Stellar, and it is small enough that one person can hold the
whole thing in their head. This guide gets you from clone to pull request.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems go through
[SECURITY.md](SECURITY.md), not public issues.

## Where to start

- Look at [`MILESTONE.md`](MILESTONE.md). Each milestone says what "done" means.
- Issues labelled `good first issue` are sized for a first contribution. Mint checks for a single chain (milestone M2)
  are a good example.
- Found a bug or a wrong status on a real transfer? Open a bug report with the transaction hash. That is one of the most
  useful things you can do.
- For anything larger than a small fix, open an issue first so we can agree on the approach before you write it.

## Set up

You need Node 20.9 or newer and [pnpm](https://pnpm.io) 10.

```bash
git clone https://github.com/Maryjane-nmesoma/tideline.git
cd tideline
pnpm install
pnpm dev            # http://localhost:3000
```

No environment variables or API keys are needed. The first page load in dev compiles routes on demand and can take 20
to 30 seconds.

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server with Turbopack |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Unit tests. No network. Fast |
| `pnpm test:live` | Tests that call the real public APIs. Slow, can fail when an upstream is down |
| `pnpm build` | Production build |

CI runs lint, typecheck, unit tests and a build on every pull request. Run them locally first:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

To build or run a second copy without disturbing a running `next dev`, use its own output folder:
`NEXT_DIST_DIR=.next-check pnpm build`.

### If requests time out on your machine

On some networks Node 24's address-family selection makes `fetch` fail with `ETIMEDOUT` while `curl` to the same host
works. If the DefiLlama or Stellar Expert panels fail locally, try:

```bash
NODE_OPTIONS=--no-network-family-autoselection pnpm dev
```

## Principles

These decide most review questions.

1. **Live data only.** No mock data, no seeded numbers, no "demo mode". A demo that looks real but is not is the one
   thing we will not merge.
2. **Say when a source is down.** An unreachable upstream shows as unreachable, with its own state. It is never
   rendered as zero, as "not supported", or as a guess.
3. **Verify, do not assume.** A CCTP transfer is Completed only when the destination chain confirms the mint. If a
   chain cannot be checked, the status stays Attested.
4. **No database, no accounts.** The app is stateless and reads public sources.
5. **No API keys by default.** Anything that needs one must be optional and leave the default experience unchanged.

## How the code is laid out

```
app/api/*          thin route handlers. Parse input, call an adapter, return JSON
lib/adapters/*     one file per upstream. Turn its response into the shared Transfer shape
lib/upstream.ts    types for the third-party responses the adapters read
lib/types.ts       the app's own models (Transfer, SepInfo, ...)
lib/*.ts           pure helpers with no network access (dust, keccak, solana, stellar, search, ...)
hooks/use-api.ts   every client data hook (React Query)
components/        UI. components/ui holds the shadcn primitives
tests/             unit tests. tests/live holds the network tests
```

Keep network access inside `lib/adapters` and the route handlers. Anything pure belongs in a file that can be tested
without a network, and should be.

### Adding or changing an adapter

1. Describe the response in `lib/upstream.ts`. Mark fields optional unless the code truly cannot work without them,
   because these APIs are not ours and change without notice.
2. Write the adapter in `lib/adapters`. Use `fetchRetry` from `lib/fetch.ts`, set a timeout, and throw a clear error on
   a non-OK response so the caller can show it.
3. Normalize into the shared model and keep that function pure so it can be tested with a recorded fixture.
4. Add a route in `app/api` if the browser needs it, and a hook in `hooks/use-api.ts`. Give the UI a loading, empty and
   error state.
5. Record the upstream, the identifiers used and any gotchas in `docs/DATA-SOURCES.md`.

### Adding a mint check for another chain

Follow the steps in [M2 of `MILESTONE.md`](MILESTONE.md#m2-mint-checks-for-sui-aptos-starknet-and-noble). The short
version: a check returns `minted` only when the chain says the message was received, `pending` only when the chain was
reached and proves it was not, and `unknown` for any failure.

## Code style

- TypeScript with `strict` on. **Do not add `any`.** If a response shape is unknown, add a type to `lib/upstream.ts`
  or use `unknown` and narrow it.
- Money and token amounts use `BigInt` and strings. Never floating point.
- Match the surrounding code. Formatting follows `.editorconfig`; ESLint is the source of truth for the rest.
- Comments explain why, not what. The reasons behind the decimal handling and the CCTP behaviour are in the README and
  `docs/DATA-SOURCES.md`; link or extend them rather than repeating them.

## Tests

- New logic needs a unit test. Fixtures are plain objects in the test file. Do not call the network from `pnpm test`.
- Bug fixes need a test that fails without the fix.
- If behaviour depends on a real chain or API, add a test under `tests/live`. Guard it with `describe.skipIf(!live)` as
  the existing ones do, so `pnpm test` stays offline.
- A good live test uses a real, old, immutable record (for example a months-old event), so it does not break when the
  chain moves on.

## Commits and pull requests

- Small, focused pull requests are reviewed faster than large ones. One milestone item or one fix per PR.
- Write commit messages in the imperative, with a short subject: `Add Sui mint check`, `Fix SEP timeout`. Explain the
  reason in the body when it is not obvious.
- Fill in the pull request template. Say what changed, why, and how you checked it. For UI changes include a screenshot.
- Update `README.md`, `docs/` and `CHANGELOG.md` when behaviour changes, and remove an entry from the README's known
  limits when you fix it.
- Keep the diff to what the change needs. Unrelated refactors belong in their own PR.

## Reviews

A maintainer will review as soon as they can. Expect questions about edge cases and failure states more than style.
Pushing follow-up commits to your branch is fine; there is no need to squash yourself.

## License

By contributing you agree that your contribution is licensed under the [MIT License](LICENSE).
