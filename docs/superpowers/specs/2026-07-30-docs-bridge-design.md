# Docs Bridge — noy-db-to → noy-db-docs release-update contract

**Status:** approved design, pre-implementation
**Date:** 2026-07-30
**Repos touched:** `noy-db-to` (producer), `noy-db-docs` (consumer)

## Problem

`noy-db-to` releases are invisible to `noy-db-docs`. The docs repo's sync runbook
(`noy-db-docs/docs/doc-sync.md`) names noy-db-to as a source of truth for the *adapters*
partition, but nothing tells it a release happened or what changed — doc/showcase/recipe updates
depend on someone hand-reading 16 CHANGELOGs. Meanwhile the family law holds: noy-db-to carries
**no documentation or non-essential production content** — per-store `README.md` (npm shopfront),
per-store `CHANGELOG.md`, and `docs/superpowers/` stay; everything else about docs is delegated
to noy-db-docs.

noy-db already solved the notification half: its `release.yml` opens a `doc-sync needed` issue in
noy-db-docs after every publish (cross-repo via a `DOCS_SYNC_TOKEN` fine-grained PAT,
`continue-on-error: true` so a docs-side outage can never fail a publish). This design adopts that
pattern and adds the missing half: a **machine-readable payload** the docs sync tooling can parse.

## Decisions (made with the maintainer, 2026-07-30)

1. **Shape:** notify-issue + structured payload, all **derived at release time** — no new committed
   metadata artifacts inside noy-db-to.
2. **Payload scope:** changelog delta + package facts **+ runtime-extracted capabilities** (real
   `store.capabilities` objects, constructed the same way the conformance suite constructs stores).
3. **Scope of work:** producer **and** the noy-db-docs consumer — the bridge is proven end-to-end.

## Producer (noy-db-to)

### `scripts/docs-bridge/` — private CI tooling (never published)

**`dump-capabilities.mts`** — constructs each of the 16 stores with the same mock/fake its
conformance test uses (`to-*/__tests__/_mock.ts` / `_fake-*.ts`, plus `node:sqlite` wrappers for
turso/d1 and a tmp dir for nfs) and serializes the returned `capabilities` object plus the factory
name. Runs as a vitest test in the root `scripts` project (`DOCS_BRIDGE_CAPS_OUT` env var triggers
the file write) — vitest resolves the mocks' `.js → .ts` source imports, which plain Node
type-stripping cannot; this also removes the `pnpm build` prerequisite and makes the dump double as
the 16-store drift alarm. The 16-entry wiring table lives in this script. Where capabilities are
option-dependent (e.g. to-turso's `txAtomic` depends on the client exposing `batch`), the dump
records the **representative default** (the conformance configuration) and marks the entry
`optionDependent: true`.

**`build-payload.mjs`** — assembles `docs-bridge.json`:

```jsonc
{
  "bridge": 1,                        // payload schema version
  "repo": "vLannaAi/noy-db-to",
  "version": "0.3.0-pre.3",           // root package.json (lockstep canonical)
  "tag": "v0.3.0-pre.3",
  "channel": "next",                  // npm dist-tag this publish routed to
  "runUrl": "https://github.com/.../actions/runs/…",
  "hubPeerRange": "^0.3.0 || ^0.4.0-pre.10",
  "packages": [
    {
      "name": "@noy-db/to-webdav",
      "dir": "to-webdav",
      "version": "0.3.0-pre.3",
      "description": "…",             // package.json description
      "factory": "toWebdav",
      "shape": "record",              // "record" | "vault" — vault (pod) stores carry capabilities: null
      "capabilities": { "casAtomic": false, "auth": { "kind": "api-key", "required": false, "flow": "static" } },
      "optionDependent": false,
      "changeType": "updated",        // added | updated | version-only
      "changelog": "### Fix: …\n\n- …" // this version's CHANGELOG section, verbatim markdown
    }
    // … one entry per published to-* package
  ]
}
```

- `shape`: `"record"` for stores exposing a real `capabilities` object, `"vault"` for pod
  (bundle) stores, which carry `capabilities: null`.
- `changelog`: the `## <version>` section extracted verbatim from the store's `CHANGELOG.md`;
  absent section → `changeType: "version-only"` and `changelog: null`.
- `changeType` (one rule, evaluated in order): `"added"` when the package has no npm-published
  version prior to this release (registry history — the release checkout has no git history at
  depth 1); else `"updated"` when the CHANGELOG has a section for this version; else
  `"version-only"`.
- The payload is **built from the tagged tree** — CHANGELOGs, package.jsons, and dists all at the
  release checkout the workflow already uses.

### `release.yml` — one new post-publish step

After `Publish stores` (same job, so it reuses the resolved dist-tag):

1. `pnpm build` artifacts already exist from the verify/publish steps; run
   `node --experimental-strip-types scripts/docs-bridge/dump-capabilities.mts > /tmp/caps.json`,
   then `node scripts/docs-bridge/build-payload.mjs --caps /tmp/caps.json --tag <git-tag>
   --channel <dist-tag> --run-url <url> > /tmp/docs-bridge.json` (the dist-tag comes from the
   workflow's existing `Resolve npm dist-tag` step output).
2. `gh release upload <tag> /tmp/docs-bridge.json` — the payload is a **release asset** (stable URL,
   fetchable by tag, no committed file).
3. Open the issue in noy-db-docs (verbatim noy-db pattern): title
   `doc-sync needed: <tag> @<channel>`, body = human summary (version, channel, run link, per-store
   one-liners derived from `changeType`) + the asset URL. `continue-on-error: true`; env
   `GH_TOKEN: ${{ secrets.DOCS_SYNC_TOKEN }}`.

**Provisioning (maintainer, one-time):** a fine-grained PAT with Issues:write on
`vLannaAi/noy-db-docs` added as `DOCS_SYNC_TOKEN` in noy-db-to's Settings → Secrets (same mechanism
noy-db already uses; the same PAT may be reused). Until provisioned, the step no-ops.

## Consumer (noy-db-docs)

### `scripts/sync/` — a noy-db-to source adapter

- New module `scripts/sync/bridge.mjs`: given `--repo vLannaAi/noy-db-to --tag <tag>` (or
  defaulting to the newest release), download `docs-bridge.json` from the release assets
  (`gh release download`), validate `bridge === 1`, and return the parsed payload.
- `sync.mjs` integrates it for the **adapters** partition: compare payload version/channel against
  `docs.manifest.json`; for each package entry emit the runbook classification —
  `ADD` (changeType added), `UPDATE` (updated; changelog markdown attached for the editor),
  `VERSION-ONLY` (bump `sinceVersion` only). Output feeds the existing "present the plan" step of
  the runbook; the runbook's decision gates are unchanged.
- **Storage capability matrix:** noy-db-docs already generates the matrix from
  `registry/scan-to-capabilities.mjs` (a static scan of the sibling noy-db-to checkout), so the
  bridge does not feed `registry/render-storage-matrix` directly. Instead it integrates as a
  **runtime-vs-static divergence gate** on that scanner (`--bridge`): the scanner's statically
  derived capabilities are compared against the bridge's real constructed `capabilities` objects
  for the 16 extended stores, and if they disagree, the sync **stops at a gate** and reports the
  divergence — same "never silently prefer either" guarantee as before, with the existing
  scan-and-render pipeline preserved.
- `docs.manifest.json` records the last-synced noy-db-to version per channel (existing per-partition
  model; no schema change).

## Testing

**noy-db-to** (existing `scripts` vitest project):
- Changelog-section extractor: given a fixture CHANGELOG, extracts exactly the `## <version>`
  section; absent version → null; malformed header → error.
- Payload builder: fixture tree → schema-complete payload; `changeType` classification covers
  added/updated/version-only.
- Capability dump: run against the real workspace — asserts 16 entries, each with a non-empty
  `capabilities` object and a `to<Backend>` factory name (this doubles as a drift alarm: a new
  17th store fails the count until wired into the dump table).

**noy-db-docs** (existing `test:sync` node --test):
- `bridge.mjs` parser against a fixture payload: classification output, schema-version rejection,
  divergence-gate triggering on a capabilities mismatch.

## Non-goals / boundaries

- **No committed metadata files in noy-db-to** — the payload exists only as a release asset.
- **No docs content, showcases, or recipes in noy-db-to** — READMEs (npm shopfront), CHANGELOGs,
  and `docs/superpowers/` stay; everything else is noy-db-docs' job.
- **Not** changing what noy-db emits — bringing the 5 essential stores' capabilities into the same
  payload shape is a noy-db follow-up (file upstream once this proves out).
- **Not** auto-editing docs pages — the bridge pre-fills the sync plan; the runbook's human gates
  stay exactly as written.

## Rollout

1. Land producer in noy-db-to (scripts + workflow step + tests) — inert until the secret exists.
2. Maintainer provisions `DOCS_SYNC_TOKEN`.
3. Land consumer in noy-db-docs (bridge.mjs + sync integration + tests).
4. Next noy-db-to release exercises the loop end-to-end; verify the issue, asset, and sync
   classification. Then file the noy-db follow-up for the essential stores.
