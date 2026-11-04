# Data sources

Every upstream Tideline reads, the identifiers it relies on, and the surprises found while integrating. Checked
against the live services in October 2026.

## LayerZero Scan

- Base: `https://scan.layerzero-api.com/v1`. No key.
- Stellar mainnet endpoint id (eid): **30600**. Ethereum 30101, Arbitrum 30110, Polygon 30109, Base 30184.
- Filter Stellar traffic with `GET /messages/latest?srcChainIds=30600` and `?dstChainIds=30600`. The API cannot OR
  the two, so the adapter fetches both and merges.
- Lookups: `/messages/tx/{hash}` (accepts Stellar hashes without `0x`), `/messages/guid/{guid}`,
  `/messages/wallet/{address}`. A miss returns HTTP 404 with a JSON body.
- **Gotcha:** `start` and `end` must be ISO 8601 strings (`2026-10-22T11:54:17.000Z`). Unix seconds and milliseconds
  both return `Invalid date`.
- Pagination uses an opaque `nextToken`.
- Stellar addresses come back as 32 raw bytes in hex. The app converts them to `G...` or `C...` and asks Horizon
  whether the account exists to decide which.
- OFT payload layout: 32 byte recipient, then an 8 byte amount in **6 decimal** shared units. Other payload lengths
  (compose messages) are not decoded.

## Circle Iris (CCTP)

- Base: `https://iris-api.circle.com/v2`. No key.
- **Stellar is domain 27.** Ethereum 0, Avalanche 1, OP 2, Arbitrum 3, Solana 5, Base 6, Polygon 7, Sui 8. The full
  list is in `lib/config.ts`.
- `GET /messages/{sourceDomain}?transactionHash=` returns the burn message, its attestation and
  `status: complete | pending_confirmations`. `complete` means **attested**, not minted.
- **Stellar hashes are queried without `0x`.** With `0x` the lookup returns 404.
- Iris returns **no timestamps**. Burn time comes from the source chain (Horizon, an EVM RPC or Solana RPC).
- The same endpoint serves both CCTP V1 and V2 messages. V2 nonces are 32 byte hex, V1 nonces are integers.
- No list endpoint exists, so CCTP is search only.
- `GET /burn/USDC/fees/{src}/{dst}` returns Fast (finality 1000) and Standard (2000) fees in basis points.

### CCTP on Stellar

| Contract | Id |
|---|---|
| TokenMessengerMinter | `CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL` |
| MessageTransmitter | `CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV` |
| CctpForwarder | `CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T` |

- A mint to Stellar goes through the forwarder, which receives the minted USDC and forwards it atomically.
- The burn amount uses 6 decimals. On mint the amount is scaled by 10 to 7 decimals.
- `message_received` events carry the burn message body, which equals Iris's `decodedMessage.messageBody`. That match
  is how Tideline confirms an inbound mint.

## Verifying a mint on the destination

| Chain | Check |
|---|---|
| EVM V2 | `eth_call usedNonces(bytes32)` (selector `0xfeb61724`) on `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64`, same address on every chain. `1` means received |
| EVM V1 | Same call on the per-chain V1 transmitter, with key `keccak256(uint32 sourceDomain, uint64 nonce)` |
| Solana | Account at PDA `["used_nonce", eventNonce]` under program `CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC`. If it exists the message was received, and its first signature is the mint transaction |
| Stellar | Search recent `message_received` events for the message body |

A zero nonce reads as used on the V2 transmitter, so reachability probes must use a random nonce.

## Stellar Expert

- Base: `https://api.stellar.expert/explorer/public`. No key.
- `GET /asset?sort=rating&order=desc&limit=200` lists the top rated assets with `tomlInfo` (issuer organization,
  declared asset type, peg), supply in stroops, trustlines, payments and last price.
- Tideline groups assets by `tomlInfo.orgName` to form **institutions**, and keeps issuers that declare a `fiat` or
  `bond` asset type plus a short allowlist of cross-chain issuers (USDT0, Allbridge, Paxos, Ondo and others).
- **Prices and volumes are unreliable for thin tokens.** One issuer reported about $38B weekly volume with 273
  holders, and a metals issuer a $5B value. Rankings use holders. USD figures are labeled estimates, and volume is not
  shown.
- `GET /asset/{CODE-ISSUER}/stats-history` returns one row per day (about 480 KB for USDC): `supply` in stroops, `trustlines` as `[total, authorized, funded]`, `payments` count. It feeds the institution history charts.
- `GET /contract/{id}/events` returns Soroban events newest first. Event ids are TOIDs, so the ledger is
  `id >> 32`.

## SEP-1, SEP-6, SEP-24, SEP-31

Each institution's `stellar.toml` is read at `https://{home_domain}/.well-known/stellar.toml`, then `/info` is called
on `TRANSFER_SERVER` (SEP-6), `TRANSFER_SERVER_SEP0024` (SEP-24) and `DIRECT_PAYMENT_SERVER` (SEP-31) to list
deposit, withdraw and payment assets with fees and limits. Many institutions publish none of these, and some domains
are slow or unreachable. The page reports that rather than guessing.

## Stellar Horizon and Soroban RPC

- Horizon `https://horizon.stellar.org`: transaction facts for Stellar burns (time, ledger, fee, source account) and
  account existence checks.
- Soroban RPC `https://mainnet.sorobanrpc.com`: `getEvents`, used to find the transaction hash of a mint. Retention is
  about 7 days.

## DefiLlama

- `https://stablecoins.llama.fi/stablecoincharts/Stellar`: daily total stablecoin supply.
- `https://stablecoins.llama.fi/stablecoincharts/Stellar?stablecoin=2`: the same series for USDC only (id 2).
- `https://stablecoins.llama.fi/stablecoins?includePrices=true`: per-asset supply and day, week and month changes,
  read from `chainCirculating.Stellar`. For USDC, `chainCirculating` lists its supply on every chain, used for the
  CCTP page's share by chain.
- The bridges API (`bridges.llama.fi`) requires a paid plan and is not used.

## Not available

- **Allbridge Core.** The documented host does not resolve. The API is offered as a self-hosted Docker service.
- **Bridge pool reserves** (CCTP, USDT0, Allbridge). No public source.

## Dust

Stellar assets use 7 decimals. CCTP and LayerZero OFT carry 6. Circle documents that a Stellar burn debits only
through the sixth decimal and the remainder stays in the sender's account. LayerZero's Stellar OFT removes dust before
sending. The OFT page says the sender keeps it only by implication (`quote_oft` reports the amount after dust
removal), so confirm with a small transfer before relying on it for a custom contract.
