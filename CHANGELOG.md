# Changelog

All notable changes to Tideline are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Unit tests (Vitest) for the dust math, search classification, hashing, Stellar address and TOID helpers, the SEP
  adapter, the ledger finder and the LayerZero and CCTP normalizers. `pnpm test`.
- Live tests against the public APIs, run on request with `pnpm test:live`.
- Typed shapes for every third-party API response in `lib/upstream.ts`.
- Contributor documentation: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `MILESTONE.md`, issue and pull
  request templates, a CI workflow and an MIT license.

### Changed

- Stellar CCTP mint checks now find the burn's ledger from its timestamp and read the MessageTransmitter events
  forward from there, instead of searching only the newest 1,000 events. Inbound transfers of any age resolve to
  **Completed**, and reaching the newest event without a match now proves the mint has not happened.
- The mint transaction hash is looked up through Horizon, which has full history, with Soroban RPC as a fallback.
  Before, it was only found for mints from roughly the last 7 days.
- SEP lookups wait up to 12 seconds per request instead of 6.
- Removed every `any` from the adapters.

### Fixed

- An anchor whose SEP server was listed but did not answer was shown as "not offered". It is now shown as
  **unreachable**, separate from a service the anchor does not list.
- The server no longer fetches non-HTTPS, IP literal, localhost or internal addresses named in an anchor's
  `stellar.toml`.
- CCTP finality labels now work whether Circle sends the threshold as a number or a string.

## [0.1.0]

First public version: LayerZero feed, CCTP burn search with destination mint verification, transfer detail with
diagnostics, institutions with live SEP ramp data, stablecoin supply, and the dust calculator.
