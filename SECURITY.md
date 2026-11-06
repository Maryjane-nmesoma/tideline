# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting: go to the repository's **Security** tab, choose **Report a vulnerability**, and describe
what you found. If that is not available, message the repository owner through their GitHub profile and ask for a
private channel.

Helpful details: what is affected, steps to reproduce, the impact you expect, and a suggested fix if you have one. We
aim to acknowledge a report within 7 days and to tell you what we plan to do within 14. Please give us a reasonable
time to fix the problem before you disclose it.

## Supported versions

Tideline is pre-1.0. Fixes go to the `main` branch. There are no maintained release branches yet.

## What the app does, for scoping

Tideline is a **read-only** web app. It has no database, no accounts, no secrets and no user data, and it does not sign
or send transactions. That narrows what can go wrong. The things worth reporting are:

- **Server-side request forgery.** The server fetches URLs that third parties control, notably the transfer servers an
  anchor lists in its `stellar.toml`. `isPublicHttpsUrl` in `lib/adapters/sep.ts` limits these to plain public HTTPS
  hostnames and rejects IP literals, localhost, `.local` and `.internal`. A bypass is in scope. A public hostname that
  resolves to a private address (DNS rebinding) is a known gap: if you deploy Tideline inside a network with sensitive
  internal services, add egress filtering in front of it.
- **Cross-site scripting and injection.** Upstream responses, token names and anchor-provided text are untrusted and
  rendered in the UI. Anything that lets them run script or alter the page is in scope.
- **Denial of service through amplification.** A single request that fans out into many upstream calls, or that can be
  used to exhaust the public RPCs we depend on.
- **Incorrect status that could mislead a user into losing funds**, for example a transfer shown as Completed when the
  mint did not happen. Treat this as a security bug.
- **Dependency vulnerabilities** that are reachable from our code.

Out of scope: problems in the third-party services themselves (LayerZero Scan, Circle Iris, Stellar Expert, Horizon,
DefiLlama, public RPCs), and reports that need a compromised machine or browser.

## For contributors

- Never commit secrets. `.env*` files are git-ignored; keep it that way.
- Treat every upstream response as untrusted input. Validate, and render text as text.
- Do not add code that signs or submits transactions without a design review. The planned rescue console is the first
  such feature and needs one.
