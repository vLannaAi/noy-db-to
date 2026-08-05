# CLAUDE.md — noy-db-to

> Part of the `lanna-db` working directory (a folder of independent repos, NOT a repo itself).
> The family-level `../CLAUDE.md` covers the cross-repo map. This file is everything you need
> for working inside `noy-db-to`.

## What this is

`noy-db-to` holds the **non-essential storage adapters** for noy-db — the cloud / server /
remote-filesystem `to-*` family. The essential, default stores (`to-memory`, `to-file`,
`to-browser-idb`, `to-meter` — probe tooling ships inside `to-meter`) live in `noy-db`;
everything else lives here. Every
adapter is a thin, ciphertext-only `NoydbStore` (or `NoydbPodStore`) implementation.

## Architecture boundary — ONE WAY, via the published seam

Each store binds **only** to the published `@noy-db/hub/to` subpath (the `NoydbStore` contract +
envelope/snapshot/op types + store errors) — never hub internals, never the main barrel. `@noy-db/hub`
is a **peerDependency at a range** (`^0.3.x`), never a `workspace:*` link. A noy-db release only forces
a rebuild here when the store contract changes. `scripts/check-architecture.mjs` enforces this
mechanically (hub-peer-range, to-only, no-crypto-deps).

## Build / test

```bash
pnpm install
pnpm build        # pnpm -r build (tsup, ESM-only)
pnpm test         # vitest run — every store's suite, against the PUBLISHED @noy-db/hub
pnpm lint && pnpm typecheck
pnpm check:architecture
```

Tests run against the **published** `@noy-db/hub` (ranged peer + exact dev pin), validating the seam
across the real published-package boundary — the klum-db model. The adapter-conformance kit
(`@noy-db/test-adapter-conformance`) is consumed the same way: a **published** package at an exact
dev pin, not a vendored copy. It was vendored in `test-support/` until noy-db `0.6.0-pre.1` published
it (see #19); the drift guard that policed that copy is gone with it.

## Conventions

- **ESM-only, Node `>=22`.** TDD; each store passes the published `@noy-db/test-adapter-conformance` suite (or hand-written tests).
- **Independent versioning** from noy-db — this repo bumps its own `0.2.0-pre.N` (lockstep across its stores).
- **Stores see ciphertext only** — no crypto deps; the hub encrypts before any store is called.

## Publishing — THIS repo is the publish source for the moved `@noy-db/to-*`

Publishing runs via `.github/workflows/release.yml`: create a GitHub Release (or `workflow_dispatch`
with `confirm: PUBLISH`); the `verify` gate (install + arch + build + lint + typecheck + test +
version↔tag) must pass before `pnpm -r publish --provenance` runs. A plain push to `release.yml` runs
verify only — never publishes. Pre-release checkbox → `@next`; unmarked → `@latest`.

### Release discipline: pre-releases, then stables

Work lands on the pre line as `0.6.0-pre.N`; stables are curated, themed promotions cut from that
line — never directly from `main` (design: `noy-db-docs/docs/superpowers/specs/
2026-08-05-family-channel-policy-design.md` §1). This repo had drifted from that habit, cutting
stable-only since `0.5.0` on 2026-07-30, which left `@next` stranded behind `@latest`. The first
`0.6.0-pre.0` publish repairs the dist-tag automatically — `release.yml` routes a pre-release to
`@next`, so no manual `npm dist-tag` move is needed.

## Hard constraints (always)

- **Never** add Claude/Anthropic attribution to commits, PRs, release notes, or CHANGELOGs.
- **Never** reference the private pilot client by name; grep the diff before every commit/publish.
- **Never** publish (or run a publish-adjacent command) without explicit user confirmation.
