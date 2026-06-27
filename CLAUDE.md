# CLAUDE.md — noy-db-to

> Part of the `lanna-db` working directory (a folder of independent repos, NOT a repo itself).
> The family-level `../CLAUDE.md` covers the cross-repo map. This file is everything you need
> for working inside `noy-db-to`.

## What this is

`noy-db-to` holds the **non-essential storage adapters** for noy-db — the cloud / server /
remote-filesystem `to-*` family extracted from the noy-db monorepo. The essential, default stores
(`to-memory`, `to-file`, `to-browser-idb`, `to-probe`, `to-meter`) stay in `noy-db`; everything
else lives here. Every adapter is a thin, ciphertext-only `NoydbStore` implementation.

## Architecture boundary — ONE WAY, via the published seam

Each store binds **only** to the published `@noy-db/hub/adapter` subpath (the `NoydbStore` contract +
envelope/snapshot/op types + store errors) — never hub internals, never the main barrel. `@noy-db/hub`
is a **peerDependency at a range** (`^0.2.x`), never a `workspace:*` link. A noy-db release only forces
a rebuild here when the adapter contract changes. `scripts/check-architecture.mjs` enforces this
mechanically (hub-peer-range, adapter-only, no-crypto-deps).

## Build / test

```bash
pnpm install
pnpm build        # pnpm -r build (tsup, ESM-only)
pnpm test         # pnpm -r test (vitest) — runs the adapter-conformance kit against PUBLISHED @noy-db/hub
pnpm lint && pnpm typecheck
pnpm check:architecture
```

Tests run against the **published** `@noy-db/hub` + `@noy-db/test-adapter-conformance` (peer range +
exact dev pin), validating the seam across the real published-package boundary — the klum-db model.

## Conventions

- **ESM-only, Node `>=22`.** TDD; each store passes the published `@noy-db/test-adapter-conformance` suite.
- **Independent versioning** from noy-db — this repo bumps its own `0.2.0-pre.N` (lockstep across its stores).
- **Stores see ciphertext only** — no crypto deps; the hub encrypts before any store is called.

## Publishing — THIS repo is the publish source for the moved `@noy-db/to-*`

Publishing runs via `.github/workflows/release.yml`: create a GitHub Release (or `workflow_dispatch`
with `confirm: PUBLISH`); the `verify` gate (install + arch + build + lint + typecheck + test +
version↔tag) must pass before `pnpm -r publish --provenance` runs. A plain push to `release.yml` runs
verify only — never publishes. Pre-release checkbox → `@next`; unmarked → `@latest`.

## Hard constraints (always)

- **Never** add Claude/Anthropic attribution to commits, PRs, release notes, or CHANGELOGs.
- **Never** reference the private pilot client by name; grep the diff before every commit/publish.
- **Never** publish (or run a publish-adjacent command) without explicit user confirmation.
