# to-rest + store-locator slice + published harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solve noy-db-to #55 (new `to-rest` store — HTTP client for `@noy-db/in-rest`'s ciphertext
RPC proxy), #56 first slice (store-locator descriptors for `to-webdav` + `to-aws-s3` on hub
0.6.0-pre.0), and #19 (source the conformance harness from a published noy-db package instead of a
synced copy).

**Architecture:** `to-rest` mirrors `by-peer`'s `peerStore()` over HTTP: every store method POSTs
`{ method, args }` to `{baseUrl}/rpc`, re-hydrating `ConflictError` from `409` envelopes. The
locator slice mirrors noy-db's `to-file` reference impl (`<kind>StoreDescriptor()` +
`<kind>StoreFactory` + `register<Kind>Store()`), with transport overrides (`fetch`/`client`)
carried by the device-local `binding` slot so descriptor→resolve→conformance round-trips run
against the existing fakes. #19 makes the harness a real published package in noy-db
(`packages/test-adapter-conformance`, tsup build, vitest+hub as peers), then this repo consumes it
and deletes the copy + sync script.

**Tech Stack:** pnpm, ESM-only, Node >=22, tsup, vitest; `@noy-db/hub@0.6.0-pre.0` (locator seam),
`@noy-db/in-rest@0.6.0-pre.0` (RPC proxy — 0.5.0 is the OLD pre-#963 architecture, do not use).

## Global Constraints

- Never add Claude/Anthropic attribution; never reference the pilot client; NEVER publish or run
  publish-adjacent commands without explicit user confirmation (#19's noy-db release stops and asks).
- TDD; ESM-only; stores see ciphertext only (no crypto deps); one PR per issue; merge after CI green.
- Peer range after Task 2: `"^0.3.0 || ^0.4.0 || ^0.5.0 || ^0.6.0-pre.0"`; dev pin `"0.6.0-pre.0"`.
- CHANGELOG entries go under `## 0.4.0` (next minor — new package + new descriptor surface).
- Do NOT touch `CLAUDE.md` (it carries the user's own uncommitted edit).
- `StoreDescriptor` is credentialless by construction; credentials only via `StoreCredentialSource`
  at `resolve()`; per-device details via `binding`.

## Verified facts (do not re-derive)

- Wire contract (`in-rest@0.6.0-pre.0` router): `POST {basePath}/rpc`, body `{ method, args }`;
  methods `get/put/delete/list/loadAll/saveAll/ping/listSince/listPage/listVaults`; `200` raw JSON
  result (`null` for voids); `401` unauthorized (fail-closed `authorize`), `403` method not in
  `allow`, `400` bad body/unknown method, `409 { error: { name: 'ConflictError', message, version } }`,
  `501 { error: { name: 'NotImplemented' } }` for unsupported optional methods, `500 { error: { name } }`.
- `createRestHandler({ store, authorize, allow?, basePath? }).handle(req: RestRequest): Promise<RestResponse>`;
  `RestRequest = { method, pathname, headers: Record<string,string>, json(): Promise<unknown> }`
  (verify exact field names from `../noy-db/packages/in-rest/src/index.ts` when writing the test adapter).
- Locator seam (hub 0.6.0-pre.0 `/to`): `StoreClass = 'local'|'browser'|'lan'|'cloud'`;
  `StoreDescriptor { kind, class, address, options? }`; `StoreFactory(descriptor, { binding?, credentials? })`;
  `StoreLocator { register(kind, factory), resolve(descriptor, opts?) }`; `createStoreLocator()`.
  Reference: `../noy-db/packages/to-file/src/index.ts:299-341` + `__tests__/locator.test.ts`.
- WIRING table (`scripts/__tests__/docs-bridge-capabilities.test.ts`) uses per-bit
  `conditionalBits?: readonly string[]`; count assertion `toHaveLength(16)` → becomes 17.
- noy-db workspace globs: `packages/*` + `test-harnesses/*`; `scripts/release.mjs` walks
  `packages/*` ONLY (why the harness never released). Harness pkg: `@noy-db/test-adapter-conformance`,
  `version 0.0.0`, `private: true`, exports raw `./src/index.ts`, vitest hard-imported but devDep.
- noy-db-docs `registry/scan-to-capabilities.mjs` has `EXPECTED_IDS` = 16 — a 17th store fails
  their scan until they add it (by design). File them an issue; do not edit their repo.
- #19's issue comments record "defer until a third consumer" — the maintainer's direct request to
  solve #19 IS the override; acknowledge in the PR body.

---

### Task 1: #55 — `to-rest` package

**Files:**
- Create: `to-rest/package.json`, `to-rest/tsconfig.json`, `to-rest/tsup.config.ts`,
  `to-rest/LICENSE`, `to-rest/README.md`, `to-rest/CHANGELOG.md` (copy shape from `to-webdav/*`)
- Create: `to-rest/src/index.ts`
- Create: `to-rest/__tests__/_harness.ts` (memory fixture store + handler-backed fetch)
- Create: `to-rest/__tests__/to-rest.test.ts`, `to-rest/__tests__/conformance.test.ts`
- Modify: `scripts/__tests__/docs-bridge-capabilities.test.ts` (WIRING + count 16→17)

**Interfaces:**
- Produces: `toRest(options: RestStoreOptions): NoydbStore & { dispose(): void }` with
  `RestStoreOptions = { baseUrl, headers?, authorize?: never — headers only, timeoutMs?, fetch? }`.
  `restHarness()` in `_harness.ts` returning `{ fetch, backing }` for tests + WIRING.

- [ ] **Step 1: Branch** `git checkout -b feat/to-rest`.
- [ ] **Step 2: Scaffold package** — copy `to-webdav/package.json` → name `@noy-db/to-rest`,
  version `0.3.1`, description "REST/HTTP adapter for noy-db — NoydbStore client for the
  @noy-db/in-rest ciphertext RPC proxy (POST /rpc); the HTTP mirror of by-peer's peerStore().",
  keywords rest/http/rpc; add `"@noy-db/in-rest": "0.6.0-pre.0"` to devDependencies; peer stays
  `"^0.3.0 || ^0.4.0 || ^0.5.0"` (Task 2 widens repo-wide). Copy tsconfig/tsup/LICENSE from
  to-webdav. `pnpm install`.
- [ ] **Step 3: Write the test harness** `to-rest/__tests__/_harness.ts`: a minimal in-memory
  `NoydbStore` fixture (nested Maps; `put` honoring `expectedVersion` with `ConflictError`;
  `loadAll` skipping `_`-prefixed collections; `listPage` by sorted-id cursor; `listVaults`),
  wrapped in `createRestHandler({ store, authorize: req => req.headers['authorization'] === 'Bearer test-key' })`,
  and a `fetch`-shaped adapter that converts `(url, init)` → `RestRequest` → `handler.handle` →
  `Response`-like `{ status, json() }`. Export `restHarness()`.
- [ ] **Step 4: Failing tests** — `to-rest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ConflictError } from '@noy-db/hub/to'
import { toRest } from '../src/index.js'
import { restHarness } from './_harness.js'

const auth = { authorization: 'Bearer test-key' }
const env = (v: number) => ({ _noydb: 1 as const, _v: v, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' })

describe('to-rest — RPC client (#55)', () => {
  it('round-trips put/get/list/delete over /rpc', async () => {
    const { fetch } = restHarness()
    const store = toRest({ baseUrl: 'https://vault.example.com', headers: auth, fetch })
    await store.put('v', 'c', 'a', env(1))
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
    expect(await store.list('v', 'c')).toEqual(['a'])
    await store.delete('v', 'c', 'a')
    expect(await store.get('v', 'c', 'a')).toBeNull()
  })

  it('re-hydrates ConflictError from a 409 envelope with the server version', async () => {
    const { fetch } = restHarness()
    const store = toRest({ baseUrl: 'https://vault.example.com', headers: auth, fetch })
    await store.put('v', 'c', 'a', env(3))
    const err = await store.put('v', 'c', 'a', env(9), 1).catch(e => e)
    expect(err).toBeInstanceOf(ConflictError)
    expect((err as ConflictError).version).toBe(3)
  })

  it('maps 401 to a clear auth error (fail-closed server)', async () => {
    const { fetch } = restHarness()
    const store = toRest({ baseUrl: 'https://vault.example.com', headers: { authorization: 'Bearer wrong' }, fetch })
    await expect(store.get('v', 'c', 'a')).rejects.toThrow(/unauthorized|401/i)
  })

  it('ping() returns false instead of throwing when the server is unreachable', async () => {
    const store = toRest({ baseUrl: 'https://vault.example.com', headers: auth, fetch: async () => { throw new Error('ECONNREFUSED') } })
    expect(await store.ping()).toBe(false)
  })
})
```

  `conformance.test.ts`: `runStoreConformanceTests('to-rest (live createRestHandler over memory fixture)', async () => toRest({ baseUrl: …, headers: auth, fetch: restHarness().fetch }))`.
  Run → FAIL (`toRest` not defined).
- [ ] **Step 5: Implement `to-rest/src/index.ts`** — mirror `by-peer/src/peer-store.ts` over HTTP:
  `call(method, args)` POSTs `{ method, args }` to `${baseUrl}/rpc` with `content-type: application/json`
  + configured headers + `AbortSignal.timeout(timeoutMs ?? 30_000)`; on non-200 parse the error
  envelope: `name === 'ConflictError' && typeof version === 'number'` → `throw new ConflictError(version, message)`;
  401 → `Error('to-rest: unauthorized (401) — check the Authorization header …')`; 403 → capability
  error mentioning the server allowlist; 501 → `Error('to-rest: method not implemented by the server store: …')`;
  else → `Error('to-rest: server error (<status>): <name>')`. Methods: the 6 core +
  `ping` (returns `call('ping', [])`, catch → `false`) + `listSince`/`listPage`/`listVaults`
  pass-throughs + `dispose()` (no-op reserved for keep-alive teardown; matches the issue's "+ dispose").
  `capabilities: { casAtomic: true /* CAS is enforced server-side by the backing store; the wire forwards expectedVersion and re-hydrates ConflictError */, auth: { kind: 'api-key', required: true, flow: 'static' } }`.
  Docblock: wire contract, security model (server sees ciphertext only), pairing with in-rest.
- [ ] **Step 6: Green** — `pnpm vitest run to-rest` then full `pnpm test` (fixture must satisfy the
  behavioral tx-less conformance: no `tx`, no `txAtomic` — biconditional holds).
- [ ] **Step 7: Wire docs-bridge** — WIRING gains
  `'to-rest': { factory: 'toRest', shape: 'record', make: () => toRest({ baseUrl: 'https://dump.example.com', headers: { authorization: 'Bearer test-key' }, fetch: restHarness().fetch }) }`
  (import from `../../to-rest/__tests__/_harness.js`); count assertion 16→17 (and the test title).
  Run `pnpm vitest run scripts/__tests__`.
- [ ] **Step 8: Docs + issue** — `CHANGELOG.md` initial `## 0.4.0` "New package" entry; README
  (usage with in-rest server snippet, auth, error mapping table). File the noy-db-docs issue:
  "registry: add to-rest to EXPECTED_IDS + storage matrix (new 17th extended store)".
- [ ] **Step 9: Gate + PR** — `pnpm test && pnpm check:architecture && pnpm lint && pnpm typecheck && pnpm build`;
  commit `feat(to-rest): NoydbStore client for the in-rest ciphertext RPC proxy (#55)`; PR "Closes #55";
  CI; merge; back to main.

---

### Task 2: #56 — store-locator first slice (webdav lan + aws-s3 cloud) on hub 0.6.0-pre.0

**Files:**
- Modify: all 17 `to-*/package.json` + `test-support/package.json` (peer range + dev pin)
- Modify: `to-webdav/src/index.ts`, `to-aws-s3/src/index.ts` (descriptor + factory + register)
- Create: `to-webdav/__tests__/locator.test.ts`, `to-aws-s3/__tests__/locator.test.ts`
- Modify: `to-webdav/CHANGELOG.md`, `to-aws-s3/CHANGELOG.md`

**Interfaces:**
- Produces: `webdavStoreDescriptor(address: { baseUrl, prefix? }, options?: { autoMkcol?, eagerMkcol? })`,
  `webdavStoreFactory: StoreFactory` (binding: `{ fetch?, headers? }`), `registerWebdavStore(locator)`;
  `s3StoreDescriptor(address: { bucket, region?, prefix? }, options?: { clockUncertaintyMs? })`,
  `s3StoreFactory: StoreFactory` (binding: `{ client? }`), `registerS3Store(locator)`.

- [ ] **Step 1: Branch** `git checkout -b feat/store-locator-slice`; widen hub peer range in all 17
  stores + dev pins to `0.6.0-pre.0` (perl one-liner over `to-*/package.json test-support/package.json`);
  `pnpm install`; `pnpm test` must stay green (contract unchanged for existing surface).
- [ ] **Step 2: Failing locator tests** — mirror `../noy-db/packages/to-file/__tests__/locator.test.ts`:
  (a) `resolve()` returns a working store (put/get round-trip against `fakeDav().fetch` /
  `fakeS3().client` supplied via `binding`); (b) descriptor is JSON-serializable and credentialless
  (`JSON.parse(JSON.stringify(d))` deep-equals; no function-typed field); (c) unknown kind →
  `resolve` throws; (d) full `runStoreConformanceTests` against a factory:
  `locator.resolve(webdavStoreDescriptor({ baseUrl: 'https://dav.example.com' }), { binding: { fetch: fakeDav().fetch } })`
  (fresh fake per test), same for s3 with `{ binding: { client: fakeS3().client } }`. Run → FAIL.
- [ ] **Step 3: Implement** — in each store's `src/index.ts` (type-only imports
  `StoreDescriptor, StoreFactory, StoreLocator` from `@noy-db/hub/to`), following the to-file
  reference shape exactly: descriptor builder (kind `'webdav'` class `'lan'` / kind `'aws-s3'`
  class `'cloud'`), factory casting `descriptor.address`/`descriptor.options` and spreading
  `opts.credentials` + binding transport overrides into the existing `toWebdav()`/`toAwsS3()`
  call, `register<Kind>Store(locator)` helper. Docblock note: binding carries device-local
  transport overrides (custom fetch wrapper / pre-built client) — never serialized into a pod.
- [ ] **Step 4: Green** — package tests, then full gate (`pnpm test && pnpm check:architecture && pnpm lint && pnpm typecheck && pnpm build`).
- [ ] **Step 5: CHANGELOGs** under `## 0.4.0`: "Store-locator descriptor adopted (#56, noy-db#945)"
  per store + hub 0.6.0-pre.0 admission note.
- [ ] **Step 6: Follow-up issue** — file ONE umbrella issue in this repo: "descriptor adoption for
  the remaining stores (#56 follow-up)" listing the issue's own store-by-store notes (cleanly
  describable: dynamo/r2/browser-local; opaque-client escape hatches; r2 plaintext-credential
  deprecation; nfs/drive binding slot); reference it from #56 before closing.
- [ ] **Step 7: PR** — commit `feat(to-webdav,to-aws-s3): store-locator descriptors — lan + cloud first slice (#56)`;
  PR "Closes #56" explaining the slice scope + follow-up issue; CI; merge.

---

### Task 3: #19 — publish the harness from noy-db; consume it here

- [ ] **Step 1 (noy-db): Branch** `feat/publish-adapter-conformance` in `../noy-db`. `git mv
  test-harnesses/adapter-conformance packages/test-adapter-conformance`. Update its package.json:
  remove `private`, version `0.6.0-pre.0` (lockstep — `release.mjs` normalizes), exports
  `{ ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } }`, `files: ["dist"]`,
  build script `tsup src/index.ts --format esm --dts`, peerDependencies
  `{ "vitest": "^3.0.0", "@noy-db/hub": "workspace:^" → published range per repo convention }`
  (check how other noy-db packages peer the hub; mirror it), publishConfig public. Keep the
  devDependency copies so the workspace installs. Add README + CHANGELOG stub per repo convention.
- [ ] **Step 2 (noy-db):** update consumers — grep `test-harnesses/adapter-conformance` references
  (turbo.json paths, CI, CLAUDE.md, check-scripts) → new path; ensure `pnpm build && pnpm test`
  green in noy-db (consumers resolve the workspace package by name, unaffected by the move).
- [ ] **Step 3 (noy-db):** PR to noy-db: `feat(test-adapter-conformance): publishable conformance
  harness (#19 mechanism)` — body acknowledges the recorded "wait for a third consumer" position
  and that the maintainer's request supersedes it; CI; merge.
- [ ] **Step 4: STOP — ASK the user** to approve the noy-db release (0.6.0-pre.1 on `@next` via
  noy-db's release flow) that first publishes `@noy-db/test-adapter-conformance`. Do NOT create
  releases or run publish commands without the go-ahead.
- [ ] **Step 5 (noy-db-to, after publish): Branch** `chore/consume-published-harness`. Delete
  `test-support/` and its workspace membership; add
  `"@noy-db/test-adapter-conformance": "0.6.0-pre.1"` (exact dev pin, repo convention) to all 17
  stores' devDependencies (replacing `workspace:*`); delete `scripts/check-harness-sync.mjs` +
  root `check:harness` script (its own header says delete rather than weaken once sourcing is real).
  `pnpm install && pnpm test` — full conformance green from the PUBLISHED harness.
- [ ] **Step 6: PR** — `test: consume the published @noy-db/test-adapter-conformance — one contract,
  one definition (#19)`; "Closes #19"; CI; merge. CHANGELOG: root-level note only if repo convention
  wants one (stores' behavior unchanged — skip per-store entries).

---

## Self-Review Notes

- #55 fully covered (wire contract, auth, error re-hydration incl. ConflictError version,
  conformance vs live handler, bridge wiring, docs issue for noy-db-docs).
- #56 scope = the issue's own first slice + umbrella follow-up (16-store adoption explicitly
  labeled follow-ups in the issue text) — surfaced to the user as a judgment call.
- #19 has the explicit publish gate (Step 4) honoring the family rule; the "defer" position is
  acknowledged, not silently overridden.
- Type consistency: factory/descriptor names match the to-file reference grammar
  (`<kind>StoreDescriptor` / `<kind>StoreFactory` / `register<Kind>Store`).
