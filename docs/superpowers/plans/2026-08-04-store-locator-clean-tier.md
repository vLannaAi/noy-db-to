# Store-Locator Clean-Tier Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `to-aws-dynamo`, `to-cloudflare-r2`, `to-browser-local` and `to-rest` a credentialless `StoreDescriptor` path via the `@noy-db/hub/to` store locator, and remove R2's plaintext credential pair.

**Architecture:** Each store gains an additive export set — `<Kind>Address`, `<Kind>DescriptorOptions`, `<Kind>Binding`, `<kind>StoreDescriptor()`, `<kind>StoreFactory`, `register<Kind>Store()` — modelled byte-for-byte on the pattern `to-webdav/src/index.ts` established in #56. The existing `to<Kind>()` factories keep working unchanged, except `to-cloudflare-r2`, which loses its plaintext `accessKeyId`/`secretAccessKey` fields, and `to-rest`, which gains a `credentials` field and per-request header assembly.

**Tech Stack:** TypeScript (ESM-only, Node >= 22), pnpm workspace, vitest, tsup. `@noy-db/hub` is a ranged peerDependency; `@noy-db/test-adapter-conformance` is a published dev dependency.

**Spec:** `docs/superpowers/specs/2026-08-04-store-locator-clean-tier-design.md`

## Global Constraints

- **Never** add Claude/Anthropic attribution to commits, PRs, release notes, or CHANGELOGs.
- **Never** reference the private pilot client by name; grep the diff before every commit.
- **Never** publish or run a publish-adjacent command without explicit user confirmation.
- Import types **only** from `@noy-db/hub/to` — never hub internals, never the main barrel. `scripts/check-architecture.mjs` enforces this.
- Do **not** change any `peerDependencies["@noy-db/hub"]` range or `devDependencies["@noy-db/hub"]` pin. The locator seam is already available in the adopted `0.6.0-pre.1`.
- Descriptors are **credentialless by construction**: no field on a `StoreDescriptor` may be typed as a function, a `StoreCredentialSource`, or a `StoreCredentials` value.
- `StoreClass` is the closed union `'local' | 'browser' | 'lan' | 'cloud'`. Do not invent a new class value.
- Stores see ciphertext only — no crypto dependencies.
- Run commands from the repo root (`/Users/vicio/lanna-db/noy-db-to`) unless stated otherwise.

## Reference Implementation

Read `to-webdav/src/index.ts:320-370` and `to-webdav/__tests__/locator.test.ts` before starting. Every task below reproduces that shape. The hub contract lives in `node_modules/.pnpm/@noy-db+hub@0.6.0-pre.1/node_modules/@noy-db/hub/dist/port/to/locator.d.ts`.

The shared test envelope literal used throughout:

```ts
const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
```

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `to-browser-local/src/index.ts` | + descriptor/factory/register block at end of file | 1 |
| `to-browser-local/__tests__/locator.test.ts` | **new** — locator suite | 1 |
| `to-aws-dynamo/src/index.ts` | + descriptor/factory/register block at end of file | 2 |
| `to-aws-dynamo/__tests__/locator.test.ts` | **new** — locator suite | 2 |
| `to-cloudflare-r2/src/index.ts` | + descriptor/factory/register block at end of file | 3 |
| `to-cloudflare-r2/__tests__/locator.test.ts` | **new** — locator suite | 3 |
| `to-rest/src/index.ts` | + `credentials` option, per-request headers | 4 |
| `to-rest/__tests__/credentials.test.ts` | **new** — auth precedence + refresh | 4 |
| `to-rest/src/index.ts` | + descriptor/factory/register block at end of file | 5 |
| `to-rest/__tests__/locator.test.ts` | **new** — locator suite | 5 |
| `to-cloudflare-r2/src/index.ts` | − plaintext credential fields (breaking) | 6 |
| `to-cloudflare-r2/__tests__/*.test.ts` | updated for the removal | 6 |
| `package.json` + 17 × `to-*/package.json` + CHANGELOGs | 0.5.0 release | 7 |

Each store's descriptor block goes at the **end** of `src/index.ts`, under a section banner comment, matching `to-webdav`.

---

### Task 1: `to-browser-local` descriptor

The simplest store in the tier — no binding, no credentials. Establishes the `browser` class.

**Files:**
- Modify: `to-browser-local/src/index.ts` (imports at `:35`; append block at end of file)
- Test: `to-browser-local/__tests__/locator.test.ts` (create)

**Interfaces:**
- Consumes: `toBrowserLocal(options: BrowserLocalOptions)` — existing, `to-browser-local/src/index.ts:65`
- Produces: `BrowserLocalAddress`, `BrowserLocalDescriptorOptions`, `browserLocalStoreDescriptor(address?, options?)`, `browserLocalStoreFactory`, `registerBrowserLocalStore(locator)`

- [ ] **Step 1: Write the failing test**

Create `to-browser-local/__tests__/locator.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerBrowserLocalStore, browserLocalStoreDescriptor } from '../src/index.js'

// noy-db-to#58 — the `browser`-class citizen: no binding, no credentials.

describe('to-browser-local — store-locator descriptor (#58)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerBrowserLocalStore(locator)
    const store = await locator.resolve(browserLocalStoreDescriptor({ prefix: 'lt' }))
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = browserLocalStoreDescriptor({ prefix: 'p' }, { obfuscate: true })
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'browser-local',
      class: 'browser',
      address: { prefix: 'p' },
      options: { obfuscate: true },
    })
  })

  it('omits the options key entirely when no options are given', () => {
    expect(browserLocalStoreDescriptor({ prefix: 'p' })).toEqual({
      kind: 'browser-local',
      class: 'browser',
      address: { prefix: 'p' },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(browserLocalStoreDescriptor({ prefix: 'p' }))).toThrow()
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests(
  'to-browser-local (descriptor-resolved via store locator)',
  async () => {
    localStorage.clear()
    const locator = createStoreLocator()
    registerBrowserLocalStore(locator)
    return locator.resolve(browserLocalStoreDescriptor({ prefix: `desc-${Date.now()}` }))
  },
  async () => {
    localStorage.clear()
  },
)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run to-browser-local/__tests__/locator.test.ts`
Expected: FAIL — `registerBrowserLocalStore` / `browserLocalStoreDescriptor` are not exported.

- [ ] **Step 3: Extend the type import**

In `to-browser-local/src/index.ts`, replace line 35:

```ts
import type { NoydbStore, EncryptedEnvelope, VaultSnapshot } from '@noy-db/hub/to'
```

with:

```ts
import type {
  NoydbStore,
  EncryptedEnvelope,
  VaultSnapshot,
  StoreDescriptor,
  StoreFactory,
  StoreLocator,
} from '@noy-db/hub/to'
```

- [ ] **Step 4: Append the descriptor block**

At the **end** of `to-browser-local/src/index.ts`:

```ts
// ─── Store-locator descriptor (#58 — `browser`-class citizen) ────────

/** Serializable location of a localStorage store: just the key prefix. */
export interface BrowserLocalAddress {
  readonly prefix?: string
}

/** Serializable tuning carried on the descriptor (never credentials). */
export interface BrowserLocalDescriptorOptions {
  readonly obfuscate?: boolean
  readonly clockUncertaintyMs?: number
}

/**
 * Builds the `StoreDescriptor` form of a `toBrowserLocal()` store:
 * `kind: 'browser-local'`, `class: 'browser'`. Credentialless by
 * construction — localStorage needs no credentials at all, so this store
 * ignores both `binding` and `credentials` at resolve time.
 */
export function browserLocalStoreDescriptor(
  address: BrowserLocalAddress = {},
  options?: BrowserLocalDescriptorOptions,
): StoreDescriptor {
  return { kind: 'browser-local', class: 'browser', address, ...(options !== undefined && { options }) }
}

/**
 * `StoreFactory` for `to-browser-local`: reconstructs the same store
 * `toBrowserLocal()` builds, from a descriptor produced by
 * {@link browserLocalStoreDescriptor}.
 */
export const browserLocalStoreFactory: StoreFactory = (descriptor) => {
  const address = descriptor.address as BrowserLocalAddress
  const options = (descriptor.options ?? {}) as BrowserLocalDescriptorOptions
  return toBrowserLocal({ ...address, ...options })
}

/** Registers {@link browserLocalStoreFactory} under the `'browser-local'` kind on `locator`. */
export function registerBrowserLocalStore(locator: StoreLocator): void {
  locator.register('browser-local', browserLocalStoreFactory)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run to-browser-local/__tests__/locator.test.ts`
Expected: PASS — 4 describe-block tests plus the full conformance suite.

- [ ] **Step 6: Verify the whole package still passes**

Run: `pnpm vitest run to-browser-local && pnpm --filter @noy-db/to-browser-local typecheck && pnpm --filter @noy-db/to-browser-local lint`
Expected: PASS, no type or lint errors.

- [ ] **Step 7: Commit**

```bash
git add to-browser-local/src/index.ts to-browser-local/__tests__/locator.test.ts
git commit -m "feat(to-browser-local): store-locator descriptor (#58)"
```

---

### Task 2: `to-aws-dynamo` descriptor

First store in the tier with a binding and credential pass-through.

**Files:**
- Modify: `to-aws-dynamo/src/index.ts` (imports at `:44`; append block at end of file)
- Test: `to-aws-dynamo/__tests__/locator.test.ts` (create)

**Interfaces:**
- Consumes: `toAwsDynamo(options: DynamoOptions)` at `to-aws-dynamo/src/index.ts:144`; `DynamoDocClient` interface exported at `:109`; `fakeDynamo()` from `to-aws-dynamo/__tests__/_fake-dynamo.ts`
- Produces: `DynamoAddress`, `DynamoBinding`, `dynamoStoreDescriptor(address)`, `dynamoStoreFactory`, `registerDynamoStore(locator)`

Note: `dynamoStoreDescriptor` takes **one** argument. This store has no serializable tuning, and an empty options bag would be speculative.

- [ ] **Step 1: Write the failing test**

Create `to-aws-dynamo/__tests__/locator.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerDynamoStore, dynamoStoreDescriptor } from '../src/index.js'
import { fakeDynamo } from './_fake-dynamo.js'

// noy-db-to#58 — `cloud` class; the document client rides the device-local
// `binding` slot, AWS credentials ride the broker seam. Neither touches the
// descriptor.

describe('to-aws-dynamo — store-locator descriptor (#58)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerDynamoStore(locator)
    const descriptor = dynamoStoreDescriptor({ table: 'locator' })
    const store = await locator.resolve(descriptor, { binding: { client: fakeDynamo().client } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = dynamoStoreDescriptor({ table: 't', region: 'eu-west-1', endpoint: 'http://localhost:8000' })
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'aws-dynamo',
      class: 'cloud',
      address: { table: 't', region: 'eu-west-1', endpoint: 'http://localhost:8000' },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(dynamoStoreDescriptor({ table: 't' }))).toThrow()
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-aws-dynamo (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerDynamoStore(locator)
  return locator.resolve(dynamoStoreDescriptor({ table: 'conformance' }), {
    binding: { client: fakeDynamo().client },
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run to-aws-dynamo/__tests__/locator.test.ts`
Expected: FAIL — exports do not exist.

- [ ] **Step 3: Extend the type import**

In `to-aws-dynamo/src/index.ts`, replace line 44:

```ts
import type { NoydbStore, EncryptedEnvelope, VaultSnapshot, StoreCredentials, StoreCredentialSource, TxOp } from '@noy-db/hub/to'
```

with:

```ts
import type {
  NoydbStore,
  EncryptedEnvelope,
  VaultSnapshot,
  StoreCredentials,
  StoreCredentialSource,
  TxOp,
  StoreDescriptor,
  StoreFactory,
  StoreLocator,
} from '@noy-db/hub/to'
```

- [ ] **Step 4: Append the descriptor block**

At the **end** of `to-aws-dynamo/src/index.ts`:

```ts
// ─── Store-locator descriptor (#58 — `cloud` class) ──────────────────

/** Serializable location of a DynamoDB store: table + region + endpoint. */
export interface DynamoAddress {
  readonly table: string
  readonly region?: string
  readonly endpoint?: string
}

/**
 * Device-local supplement resolved at `resolve()` time — a pre-built
 * document client (shared client, custom middleware, or a test fake).
 * Never serialized into a pod alongside the descriptor.
 */
export interface DynamoBinding {
  readonly client?: DynamoDocClient
}

/**
 * Builds the `StoreDescriptor` form of a `toAwsDynamo()` store:
 * `kind: 'aws-dynamo'`, `class: 'cloud'`. Credentialless by construction —
 * AWS credentials arrive via `StoreCredentialSource` at `resolve()` time
 * (the #479 broker seam), or implicitly via the SDK's default provider
 * chain on the device.
 *
 * Takes no options argument: this store has no serializable tuning today.
 */
export function dynamoStoreDescriptor(address: DynamoAddress): StoreDescriptor {
  return { kind: 'aws-dynamo', class: 'cloud', address }
}

/**
 * `StoreFactory` for `to-aws-dynamo`: reconstructs the same store
 * `toAwsDynamo()` builds, from a descriptor produced by
 * {@link dynamoStoreDescriptor}. `opts.credentials` becomes the SDK's
 * refresh hook; `opts.binding` may carry a pre-built client
 * ({@link DynamoBinding}), which always wins.
 */
export const dynamoStoreFactory: StoreFactory = (descriptor, opts) => {
  const address = descriptor.address as DynamoAddress
  const binding = (opts.binding ?? {}) as DynamoBinding
  return toAwsDynamo({
    ...address,
    ...(opts.credentials !== undefined && { credentials: opts.credentials }),
    ...(binding.client !== undefined && { client: binding.client }),
  })
}

/** Registers {@link dynamoStoreFactory} under the `'aws-dynamo'` kind on `locator`. */
export function registerDynamoStore(locator: StoreLocator): void {
  locator.register('aws-dynamo', dynamoStoreFactory)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run to-aws-dynamo/__tests__/locator.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify the whole package still passes**

Run: `pnpm vitest run to-aws-dynamo && pnpm --filter @noy-db/to-aws-dynamo typecheck && pnpm --filter @noy-db/to-aws-dynamo lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add to-aws-dynamo/src/index.ts to-aws-dynamo/__tests__/locator.test.ts
git commit -m "feat(to-aws-dynamo): store-locator descriptor (#58)"
```

---

### Task 3: `to-cloudflare-r2` descriptor (additive only)

Adds the descriptor path. The plaintext credential removal is deliberately **not** here — it lands in Task 6 so the breaking change is reviewable on its own.

**Files:**
- Modify: `to-cloudflare-r2/src/index.ts` (imports at `:41`; append block at end of file)
- Test: `to-cloudflare-r2/__tests__/locator.test.ts` (create)

**Interfaces:**
- Consumes: `toCloudflareR2(options: R2Options)` at `to-cloudflare-r2/src/index.ts:97`; `S3Client` type imported at `:42`; `fakeS3()` from `to-aws-s3/__tests__/_fake-s3.ts`
- Produces: `R2Address`, `R2DescriptorOptions`, `R2Binding`, `r2StoreDescriptor(address, options?)`, `r2StoreFactory`, `registerR2Store(locator)`

- [ ] **Step 1: Write the failing test**

Create `to-cloudflare-r2/__tests__/locator.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerR2Store, r2StoreDescriptor } from '../src/index.js'
import { fakeS3 } from '../../to-aws-s3/__tests__/_fake-s3.js'

// noy-db-to#58 — `cloud` class. R2 keys are S3-compatible, so credentials
// ride the broker seam as `kind: 'aws'`; the descriptor never carries them.

describe('to-cloudflare-r2 — store-locator descriptor (#58)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerR2Store(locator)
    const descriptor = r2StoreDescriptor({ bucket: 'locator', accountId: 'acc' })
    const store = await locator.resolve(descriptor, { binding: { client: fakeS3().client } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = r2StoreDescriptor(
      { bucket: 'b', accountId: 'acc', prefix: 'p', endpoint: 'https://r2.example.com' },
      { clockUncertaintyMs: 1000 },
    )
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'cloudflare-r2',
      class: 'cloud',
      address: { bucket: 'b', accountId: 'acc', prefix: 'p', endpoint: 'https://r2.example.com' },
      options: { clockUncertaintyMs: 1000 },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(r2StoreDescriptor({ bucket: 'b', accountId: 'acc' }))).toThrow()
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-cloudflare-r2 (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerR2Store(locator)
  return locator.resolve(r2StoreDescriptor({ bucket: 'conformance', accountId: 'acc' }), {
    binding: { client: fakeS3().client },
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run to-cloudflare-r2/__tests__/locator.test.ts`
Expected: FAIL — exports do not exist.

- [ ] **Step 3: Extend the type import**

In `to-cloudflare-r2/src/index.ts`, replace line 41:

```ts
import type { NoydbStore, StoreCredentialSource } from '@noy-db/hub/to'
```

with:

```ts
import type {
  NoydbStore,
  StoreCredentialSource,
  StoreDescriptor,
  StoreFactory,
  StoreLocator,
} from '@noy-db/hub/to'
```

- [ ] **Step 4: Append the descriptor block**

At the **end** of `to-cloudflare-r2/src/index.ts`:

```ts
// ─── Store-locator descriptor (#58 — `cloud` class) ──────────────────

/**
 * Serializable location of an R2 store. `endpoint` is location, not
 * tuning: it selects which server the store talks to, so it belongs on
 * the address rather than in `options`.
 */
export interface R2Address {
  readonly bucket: string
  readonly accountId?: string
  readonly prefix?: string
  readonly endpoint?: string
}

/** Serializable tuning carried on the descriptor (never credentials). */
export interface R2DescriptorOptions {
  readonly clockUncertaintyMs?: number
}

/**
 * Device-local supplement resolved at `resolve()` time — a pre-built
 * `S3Client` (a shared R2-pointed client, a Workers binding, or a test
 * fake). Never serialized into a pod alongside the descriptor.
 */
export interface R2Binding {
  readonly client?: S3Client
}

/**
 * Builds the `StoreDescriptor` form of a `toCloudflareR2()` store:
 * `kind: 'cloudflare-r2'`, `class: 'cloud'`. Credentialless by
 * construction — R2 keys are S3-compatible, so credentials arrive via a
 * `StoreCredentialSource` yielding `kind: 'aws'` at `resolve()` time.
 */
export function r2StoreDescriptor(address: R2Address, options?: R2DescriptorOptions): StoreDescriptor {
  return { kind: 'cloudflare-r2', class: 'cloud', address, ...(options !== undefined && { options }) }
}

/**
 * `StoreFactory` for `to-cloudflare-r2`: reconstructs the same store
 * `toCloudflareR2()` builds, from a descriptor produced by
 * {@link r2StoreDescriptor}. `opts.binding` may carry a pre-built client
 * ({@link R2Binding}), which always wins over `accountId` + credentials.
 */
export const r2StoreFactory: StoreFactory = (descriptor, opts) => {
  const address = descriptor.address as R2Address
  const options = (descriptor.options ?? {}) as R2DescriptorOptions
  const binding = (opts.binding ?? {}) as R2Binding
  return toCloudflareR2({
    ...address,
    ...options,
    ...(opts.credentials !== undefined && { credentials: opts.credentials }),
    ...(binding.client !== undefined && { client: binding.client }),
  })
}

/** Registers {@link r2StoreFactory} under the `'cloudflare-r2'` kind on `locator`. */
export function registerR2Store(locator: StoreLocator): void {
  locator.register('cloudflare-r2', r2StoreFactory)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run to-cloudflare-r2/__tests__/locator.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify the whole package still passes**

Run: `pnpm vitest run to-cloudflare-r2 && pnpm --filter @noy-db/to-cloudflare-r2 typecheck && pnpm --filter @noy-db/to-cloudflare-r2 lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add to-cloudflare-r2/src/index.ts to-cloudflare-r2/__tests__/locator.test.ts
git commit -m "feat(to-cloudflare-r2): store-locator descriptor (#58)"
```

---

### Task 4: `to-rest` credential broker + per-request headers

A behavioural change to `to-rest` independent of the locator: auth moves onto the credential-broker seam so expiring tokens work. Must land before Task 5, which wires the descriptor to it.

**Files:**
- Modify: `to-rest/src/index.ts` (imports at `:45`; `RestStoreOptions` at `:49-59`; `toRest` body at `:73-90`)
- Test: `to-rest/__tests__/credentials.test.ts` (create)

**Interfaces:**
- Consumes: `toRest(options: RestStoreOptions)` at `to-rest/src/index.ts:73`; `restHarness()` from `to-rest/__tests__/_harness.ts` — its handler authorizes exactly `Authorization: Bearer test-key` (`_harness.ts:94`)
- Produces: `RestStoreOptions.credentials?: StoreCredentialSource`

- [ ] **Step 1: Write the failing test**

Create `to-rest/__tests__/credentials.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { StoreCredentials } from '@noy-db/hub/to'
import { toRest } from '../src/index.js'
import { restHarness } from './_harness.js'

const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }

describe('to-rest — credential broker (#58)', () => {
  it('sends a bearer token from a credential source', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      credentials: async () => ({ kind: 'token', token: 'test-key' }),
      fetch: restHarness().fetch,
    })
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('re-invokes the source on every request, so rolling tokens work', async () => {
    let calls = 0
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      credentials: async () => {
        calls++
        return { kind: 'token', token: 'test-key' }
      },
      fetch: restHarness().fetch,
    })
    await store.put('v', 'c', 'a', envelope)
    await store.get('v', 'c', 'a')
    expect(calls).toBe(2)
  })

  it('credentials override an authorization header supplied via headers', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      headers: { authorization: 'Bearer WRONG', 'x-tenant': 'acme' },
      credentials: async () => ({ kind: 'token', token: 'test-key' }),
      fetch: restHarness().fetch,
    })
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('rejects a credential kind other than token', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      credentials: async () => ({ kind: 'aws', accessKeyId: 'k', secretAccessKey: 's' }) as StoreCredentials,
      fetch: restHarness().fetch,
    })
    await expect(store.get('v', 'c', 'a')).rejects.toThrow(/kind 'aws'/)
  })

  it('still works with a static authorization header and no credentials', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      headers: { authorization: 'Bearer test-key' },
      fetch: restHarness().fetch,
    })
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run to-rest/__tests__/credentials.test.ts`
Expected: FAIL — `credentials` is not a known property of `RestStoreOptions`; the bearer tests get 401.

- [ ] **Step 3: Extend the type import**

In `to-rest/src/index.ts`, replace line 45:

```ts
import type { NoydbStore, EncryptedEnvelope, VaultSnapshot, ListPageResult } from '@noy-db/hub/to'
```

with:

```ts
import type {
  NoydbStore,
  EncryptedEnvelope,
  VaultSnapshot,
  ListPageResult,
  StoreCredentialSource,
} from '@noy-db/hub/to'
```

- [ ] **Step 4: Add the `credentials` option**

In `to-rest/src/index.ts`, inside `RestStoreOptions`, immediately after the `headers` field:

```ts
  /**
   * Rolling short-lived credentials source (the hub's #479 credential-broker
   * seam). Must yield `kind: 'token'`; the token becomes
   * `Authorization: Bearer <token>` and the source is re-invoked on every
   * request, so an expiring token refreshes without rebuilding the store.
   * Takes precedence over any `authorization` key in `headers`.
   */
  readonly credentials?: StoreCredentialSource
```

- [ ] **Step 5: Move header assembly per-request**

In `to-rest/src/index.ts`, inside `toRest()`, add this helper immediately after the `rpcUrl` assignment:

```ts
  async function authHeader(): Promise<Record<string, string>> {
    if (!options.credentials) return {}
    const creds = await options.credentials()
    if (creds.kind !== 'token') {
      throw new Error(
        `to-rest: credentials of kind '${creds.kind}' are not supported — to-rest authenticates with a bearer token (kind: 'token').`,
      )
    }
    return { authorization: `Bearer ${creds.token}` }
  }
```

Then inside `call()`, replace the `headers` line of the `fetchImpl` call:

```ts
      headers: { 'content-type': 'application/json', ...headers },
```

with:

```ts
      headers: { 'content-type': 'application/json', ...headers, ...(await authHeader()) },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run to-rest/__tests__/credentials.test.ts`
Expected: PASS — all 5 tests.

- [ ] **Step 7: Verify the existing suite is unaffected**

Run: `pnpm vitest run to-rest && pnpm --filter @noy-db/to-rest typecheck && pnpm --filter @noy-db/to-rest lint`
Expected: PASS. The existing `conformance.test.ts` uses the static `headers` path and must still pass unchanged — that is the regression guard for the direct-construction path.

- [ ] **Step 8: Commit**

```bash
git add to-rest/src/index.ts to-rest/__tests__/credentials.test.ts
git commit -m "feat(to-rest): bearer auth via the credential broker (#58)"
```

---

### Task 5: `to-rest` descriptor

**Files:**
- Modify: `to-rest/src/index.ts` (append block at end of file)
- Test: `to-rest/__tests__/locator.test.ts` (create)

**Interfaces:**
- Consumes: `toRest(options: RestStoreOptions)` including the `credentials` field added in Task 4; `restHarness()` from `to-rest/__tests__/_harness.ts`
- Produces: `RestAddress`, `RestDescriptorOptions`, `RestBinding`, `restStoreDescriptor(address, options?)`, `restStoreFactory`, `registerRestStore(locator)`

- [ ] **Step 1: Write the failing test**

Create `to-rest/__tests__/locator.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerRestStore, restStoreDescriptor } from '../src/index.js'
import { restHarness } from './_harness.js'

// noy-db-to#58 — `cloud` class. to-rest's options violate the credentialless
// rule twice (`fetch` is a function, `headers` carries the bearer token), so
// they are partitioned: transport into `binding`, auth onto the broker.

describe('to-rest — store-locator descriptor (#58)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerRestStore(locator)
    const descriptor = restStoreDescriptor({ baseUrl: 'https://vault.example.com' })
    const store = await locator.resolve(descriptor, {
      binding: { fetch: restHarness().fetch },
      credentials: async () => ({ kind: 'token', token: 'test-key' }),
    })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = restStoreDescriptor({ baseUrl: 'https://vault.example.com' }, { timeoutMs: 5000 })
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'rest',
      class: 'cloud',
      address: { baseUrl: 'https://vault.example.com' },
      options: { timeoutMs: 5000 },
    })
  })

  it('carries non-auth headers through the binding slot', async () => {
    const locator = createStoreLocator()
    registerRestStore(locator)
    const store = await locator.resolve(restStoreDescriptor({ baseUrl: 'https://vault.example.com' }), {
      binding: { fetch: restHarness().fetch, headers: { 'x-tenant': 'acme' } },
      credentials: async () => ({ kind: 'token', token: 'test-key' }),
    })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(restStoreDescriptor({ baseUrl: 'https://x' }))).toThrow()
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-rest (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerRestStore(locator)
  return locator.resolve(restStoreDescriptor({ baseUrl: 'https://vault.example.com' }), {
    binding: { fetch: restHarness().fetch },
    credentials: async () => ({ kind: 'token', token: 'test-key' }),
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run to-rest/__tests__/locator.test.ts`
Expected: FAIL — exports do not exist.

- [ ] **Step 3: Extend the type import**

In `to-rest/src/index.ts`, add `StoreDescriptor`, `StoreFactory` and `StoreLocator` to the `@noy-db/hub/to` type import edited in Task 4, giving:

```ts
import type {
  NoydbStore,
  EncryptedEnvelope,
  VaultSnapshot,
  ListPageResult,
  StoreCredentialSource,
  StoreDescriptor,
  StoreFactory,
  StoreLocator,
} from '@noy-db/hub/to'
```

- [ ] **Step 4: Append the descriptor block**

At the **end** of `to-rest/src/index.ts`:

```ts
// ─── Store-locator descriptor (#58 — `cloud` class) ──────────────────

/** Serializable location of a rest store: the in-rest handler's base URL. */
export interface RestAddress {
  readonly baseUrl: string
}

/** Serializable tuning carried on the descriptor (never credentials). */
export interface RestDescriptorOptions {
  readonly timeoutMs?: number
}

/**
 * Device-local supplement resolved at `resolve()` time. Both fields are
 * barred from the descriptor: `fetch` is a function, and `headers` is
 * where an `authorization` value would otherwise leak. Auth belongs on
 * `credentials`; `headers` here is for non-auth headers such as tenant
 * routing or tracing.
 */
export interface RestBinding {
  readonly fetch?: typeof fetch
  readonly headers?: Record<string, string>
}

/**
 * Builds the `StoreDescriptor` form of a `toRest()` store:
 * `kind: 'rest'`, `class: 'cloud'`. Credentialless by construction — the
 * bearer token arrives via a `StoreCredentialSource` of `kind: 'token'`
 * at `resolve()` time and is re-read on every request.
 */
export function restStoreDescriptor(address: RestAddress, options?: RestDescriptorOptions): StoreDescriptor {
  return { kind: 'rest', class: 'cloud', address, ...(options !== undefined && { options }) }
}

/**
 * `StoreFactory` for `to-rest`: reconstructs the same store `toRest()`
 * builds, from a descriptor produced by {@link restStoreDescriptor}.
 * `opts.binding` supplies the transport ({@link RestBinding});
 * `opts.credentials` supplies auth, which wins over any `authorization`
 * key in `binding.headers`.
 */
export const restStoreFactory: StoreFactory = (descriptor, opts) => {
  const address = descriptor.address as RestAddress
  const options = (descriptor.options ?? {}) as RestDescriptorOptions
  const binding = (opts.binding ?? {}) as RestBinding
  return toRest({
    ...address,
    ...options,
    ...(binding.headers !== undefined && { headers: binding.headers }),
    ...(binding.fetch !== undefined && { fetch: binding.fetch }),
    ...(opts.credentials !== undefined && { credentials: opts.credentials }),
  })
}

/** Registers {@link restStoreFactory} under the `'rest'` kind on `locator`. */
export function registerRestStore(locator: StoreLocator): void {
  locator.register('rest', restStoreFactory)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run to-rest/__tests__/locator.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify the whole package still passes**

Run: `pnpm vitest run to-rest && pnpm --filter @noy-db/to-rest typecheck && pnpm --filter @noy-db/to-rest lint`
Expected: PASS.

- [ ] **Step 7: Full-repo gate before opening PR A**

Run: `pnpm check:architecture && pnpm build && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green. Test count should be **higher** than the 981 baseline — four new locator suites plus the rest credential suite.

- [ ] **Step 8: Commit and open PR A**

```bash
git add to-rest/src/index.ts to-rest/__tests__/locator.test.ts
git commit -m "feat(to-rest): store-locator descriptor (#58)"
git push -u origin feat/58-locator-clean-tier
```

Open the PR with title `feat: store-locator descriptors for the clean tier (#58)`. Body must state: additive only, no version bump, no hub range change, and that the R2 plaintext removal follows in a separate PR. Reference `Refs #58`, not `Closes` — the umbrella covers two more tiers.

---

### Task 6: Remove R2's plaintext credential pair (breaking)

Lands on its own branch and PR so the break is bisectable.

**Files:**
- Modify: `to-cloudflare-r2/src/index.ts` — module docblock example at `:29-30`, `R2Options` fields at `:54-60`, validation at `:119-121`, config at `:127-133`
- Modify: `to-cloudflare-r2/__tests__/credentials.test.ts` — lines `:64-65`, `:86`, `:90-91`
- Modify: `to-cloudflare-r2/__tests__/to-cloudflare-r2.test.ts` — lines `:32`, `:37`, `:53-54`
- Modify: `to-cloudflare-r2/README.md` — any static-key example

**Interfaces:**
- Consumes: `R2Options` — `accessKeyId` and `secretAccessKey` are deleted from it
- Produces: `R2Options` with exactly two auth paths, `credentials` and `client`

- [ ] **Step 1: Branch from the PR A branch**

```bash
git checkout -b feat/58-r2-drop-plaintext-credentials
```

- [ ] **Step 2: Write the failing test**

In `to-cloudflare-r2/__tests__/to-cloudflare-r2.test.ts`, replace the assertion at line 37:

```ts
    expect(() => toCloudflareR2({ accountId: 'acc', bucket: 'b' })).toThrow(/accessKeyId.*secretAccessKey/)
```

with:

```ts
    expect(() => toCloudflareR2({ accountId: 'acc', bucket: 'b' })).toThrow(
      /`credentials` source or a pre-built `client`/,
    )
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run to-cloudflare-r2/__tests__/to-cloudflare-r2.test.ts`
Expected: FAIL — the current error message still names `accessKeyId`/`secretAccessKey`.

- [ ] **Step 4: Delete the fields**

In `to-cloudflare-r2/src/index.ts`, delete these two members of `R2Options` and their JSDoc (currently `:52-60`):

```ts
  /**
   * R2 access key id. Required unless `client` or `credentials` is
   * supplied. Prefer short-lived credentials via the account's API
   * token flow.
   */
  readonly accessKeyId?: string
  /** R2 secret access key. Required unless `client` or `credentials` is supplied. */
  readonly secretAccessKey?: string
```

Then amend the `credentials` JSDoc, removing the sentence `Takes precedence over the static \`accessKeyId\`/\`secretAccessKey\` pair;` so it reads `… the SDK re-invokes it near \`expiresAt\`. Ignored when \`client\` is supplied (a pre-built client always wins).`

- [ ] **Step 5: Replace the validation**

Replace the block at `:119-121`:

```ts
  if (!options.credentials && (!options.accessKeyId || !options.secretAccessKey)) {
    throw new Error('@noy-db/to-cloudflare-r2: `accessKeyId` and `secretAccessKey` (or a `credentials` source) are required (unless `client` is supplied).')
  }
```

with:

```ts
  if (!options.credentials) {
    throw new Error(
      '@noy-db/to-cloudflare-r2: authentication requires a `credentials` source or a pre-built `client`. ' +
        'Static keys are no longer accepted — wrap them: `credentials: async () => ({ kind: "aws", accessKeyId, secretAccessKey })`.',
    )
  }
```

- [ ] **Step 6: Simplify the SDK config**

Replace the `credentials` property of the `S3ClientConfig` at `:127-133`:

```ts
    credentials: options.credentials
      ? async () => mapAws(await options.credentials!())
      : {
          accessKeyId: options.accessKeyId!,
          secretAccessKey: options.secretAccessKey!,
        },
```

with:

```ts
    credentials: async () => mapAws(await options.credentials!()),
```

- [ ] **Step 7: Update the module docblock example**

In `to-cloudflare-r2/src/index.ts`, replace the example lines at `:29-30`:

```ts
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID!,
 *   secretAccessKey: process.env.R2_SECRET!,
```

with:

```ts
 *   credentials: async () => ({
 *     kind: 'aws',
 *     accessKeyId: process.env.R2_ACCESS_KEY_ID!,
 *     secretAccessKey: process.env.R2_SECRET!,
 *   }),
```

- [ ] **Step 8: Update the remaining test call sites**

There are four more static-key call sites. Take them in order.

**8a.** `to-cloudflare-r2/__tests__/to-cloudflare-r2.test.ts:30-34` — the accountId-validation test. Replace:

```ts
  it('requires accountId when no client is supplied', () => {
    expect(() =>
      toCloudflareR2({ bucket: 'b', accessKeyId: 'k', secretAccessKey: 's' }),
    ).toThrow(/client.*accountId/i)
  })
```

with:

```ts
  it('requires accountId when no client is supplied', () => {
    expect(() =>
      toCloudflareR2({
        bucket: 'b',
        credentials: async () => ({ kind: 'aws', accessKeyId: 'k', secretAccessKey: 's' }),
      }),
    ).toThrow(/client.*accountId/i)
  })
```

The `accountId` check runs before the credentials check, so this still exercises the intended branch.

**8b.** `to-cloudflare-r2/__tests__/to-cloudflare-r2.test.ts:49-57` — the store-name test. Replace:

```ts
  it('name is "cloudflare-r2" when constructed with credentials', () => {
    const store = toCloudflareR2({
      accountId: 'acc',
      bucket: 'b',
      accessKeyId: 'k',
      secretAccessKey: 's',
    })
    expect(store.name).toBe('cloudflare-r2')
  })
```

with:

```ts
  it('name is "cloudflare-r2" when constructed with credentials', () => {
    const store = toCloudflareR2({
      accountId: 'acc',
      bucket: 'b',
      credentials: async () => ({ kind: 'aws', accessKeyId: 'k', secretAccessKey: 's' }),
    })
    expect(store.name).toBe('cloudflare-r2')
  })
```

**8c.** `to-cloudflare-r2/__tests__/credentials.test.ts:60-66` — the precedence test passes both the static pair and a source, asserting the source wins. With the pair gone there is nothing to take precedence over, so drop the two static lines. Replace:

```ts
    toCloudflareR2({
      bucket: 'b',
      accountId: 'acc',
      accessKeyId: 'STATIC_KEY',
      secretAccessKey: 'STATIC_SECRET',
      credentials: async () => ROLLING,
    })
```

with:

```ts
    toCloudflareR2({
      bucket: 'b',
      accountId: 'acc',
      credentials: async () => ROLLING,
    })
```

Rename that test to `'builds a function-valued SDK credentials provider from a credentials source'` — it no longer tests precedence.

**8d.** `to-cloudflare-r2/__tests__/credentials.test.ts:75-95` — the whole `it('keeps the static-keys path byte-identical when credentials is not supplied', …)` case tests a path that no longer exists. Delete it entirely and put this in its place:

```ts
  it('rejects construction with neither credentials nor client', () => {
    expect(() => toCloudflareR2({ bucket: 'b', accountId: 'acc' })).toThrow(
      /`credentials` source or a pre-built `client`/,
    )
  })
```

This test needs no `vi.doMock` — construction throws before any `S3Client` is built. If the surrounding `describe` imports `toCloudflareR2` dynamically for mocking, import it statically at the top of the file for this case.

- [ ] **Step 9: Update the README**

Run `grep -n "accessKeyId" to-cloudflare-r2/README.md`. Replace every static-key example with the credentials-wrapper form from Step 7. If grep returns nothing, skip.

- [ ] **Step 10: Run the package suite**

Run: `pnpm vitest run to-cloudflare-r2 && pnpm --filter @noy-db/to-cloudflare-r2 typecheck && pnpm --filter @noy-db/to-cloudflare-r2 lint`
Expected: PASS, with no reference to `accessKeyId` remaining in `src/`.

Verify: `grep -rn "accessKeyId\|secretAccessKey" to-cloudflare-r2/src/` should return **only** the docblock example and the error-message migration hint.

- [ ] **Step 11: Add the CHANGELOG migration note**

At the top of `to-cloudflare-r2/CHANGELOG.md`, immediately under the `# @noy-db/to-cloudflare-r2` heading, add an `## Unreleased` section:

```markdown
## Unreleased

### BREAKING: `accessKeyId` / `secretAccessKey` removed from `toCloudflareR2()` ([#58](https://github.com/vLannaAi/noy-db-to/issues/58))

Authentication now has exactly two paths: a `credentials` source (the credential-broker seam) or a pre-built `client`. The plaintext pair could not be offered on the store-locator descriptor path without breaking the credentialless-by-construction rule, and keeping it on the direct path would have split authentication into two stories that diverge by construction method.

Migration — wrap existing static keys:

```ts
// before
toCloudflareR2({ bucket, accountId, accessKeyId, secretAccessKey })

// after
toCloudflareR2({ bucket, accountId, credentials: async () => ({
  kind: 'aws', accessKeyId, secretAccessKey,
}) })
```
```

- [ ] **Step 12: Full-repo gate**

Run: `pnpm check:architecture && pnpm build && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 13: Commit and open PR B**

```bash
git add to-cloudflare-r2/
git commit -m "feat(to-cloudflare-r2)!: drop plaintext accessKeyId/secretAccessKey (#58)"
git push -u origin feat/58-r2-drop-plaintext-credentials
```

Open the PR with title `feat(to-cloudflare-r2)!: drop plaintext credentials (#58)`. Body must show the before/after migration snippet and state that the repo goes to 0.5.0 as a result. Base it on the PR A branch; if PR A has already merged, rebase onto `main` first.

---

### Task 7: Release 0.5.0

> **DEFERRED — do not execute this task yet (decision of 2026-08-05).**
>
> The release is held until **all three tiers of #58** have landed, so the locator
> story ships as one coherent release with a single migration note instead of two.
> Tier 1 (this plan) merges to `main` and sits there unreleased.
>
> This is deliberately safe: what is deferred is the version bump *and* the publish
> together, so `main` stays honestly at `0.4.0` and no manifest ever claims a version
> that is absent from npm — the phantom-version failure mode the family CLAUDE.md
> warns about. The package CHANGELOGs carry `## Unreleased` sections, not version
> headings, for exactly this reason.
>
> When the release does happen it will cover all three tiers, so the version may not
> be `0.5.0` and the CHANGELOG copy below will need rewriting to match the full
> scope. Treat the steps here as the mechanical recipe, not the final content.

Only after PRs A and B have merged to `main` **and tiers 2 and 3 of #58 are complete**.

**Files:**
- Modify: `package.json` (root `version`)
- Modify: all 17 `to-*/package.json` (`version`)
- Modify: `to-aws-dynamo/CHANGELOG.md`, `to-browser-local/CHANGELOG.md`, `to-cloudflare-r2/CHANGELOG.md`, `to-rest/CHANGELOG.md` (real entries); the other 13 CHANGELOGs get a version heading only

**Interfaces:**
- Consumes: nothing
- Produces: version `0.5.0` across the repo, matching the tag `release.yml` verifies

- [ ] **Step 1: Branch from updated main**

```bash
git checkout main && git pull --ff-only && git checkout -b release/0.5.0
```

- [ ] **Step 2: Bump every version**

```bash
node -e '
const fs = require("fs");
const dirs = [".", ...fs.readdirSync(".").filter(d => d.startsWith("to-"))];
for (const d of dirs) {
  const p = `${d}/package.json`;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  j.version = "0.5.0";
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}
console.log(`bumped ${dirs.length} package.json files`);
'
```

Expected output: `bumped 18 package.json files`.

- [ ] **Step 3: Verify the bump**

```bash
grep -h '"version"' package.json to-*/package.json | sort -u
```

Expected: a single line, `  "version": "0.5.0",`.

- [ ] **Step 4: Write the CHANGELOG entries**

In `to-cloudflare-r2/CHANGELOG.md`, change the `## Unreleased` heading added in Task 6 Step 11 to `## 0.5.0`, and add a second section under it:

```markdown
### Store-locator descriptor ([#58](https://github.com/vLannaAi/noy-db-to/issues/58))

- `r2StoreDescriptor({ bucket, accountId?, prefix?, endpoint? }, { clockUncertaintyMs? })` + `registerR2Store(locator)` — the `cloud`-class descriptor path. The `S3Client` override rides the device-local `binding` slot; credentials ride the broker. Verified by a descriptor→`resolve()`→full-conformance round-trip.
```

In `to-aws-dynamo/CHANGELOG.md`, add at the top under the package heading:

```markdown
## 0.5.0

### Store-locator descriptor ([#58](https://github.com/vLannaAi/noy-db-to/issues/58))

- `dynamoStoreDescriptor({ table, region?, endpoint? })` + `registerDynamoStore(locator)` — the `cloud`-class descriptor path. The document client rides the device-local `binding` slot; AWS credentials ride the broker seam. Verified by a descriptor→`resolve()`→full-conformance round-trip.
```

In `to-browser-local/CHANGELOG.md`:

```markdown
## 0.5.0

### Store-locator descriptor ([#58](https://github.com/vLannaAi/noy-db-to/issues/58))

- `browserLocalStoreDescriptor({ prefix? }, { obfuscate?, clockUncertaintyMs? })` + `registerBrowserLocalStore(locator)` — the `browser`-class reference. Needs neither a binding nor credentials. Verified by a descriptor→`resolve()`→full-conformance round-trip.
```

In `to-rest/CHANGELOG.md`:

```markdown
## 0.5.0

### Store-locator descriptor + credential broker ([#58](https://github.com/vLannaAi/noy-db-to/issues/58))

- `restStoreDescriptor({ baseUrl }, { timeoutMs? })` + `registerRestStore(locator)` — the `cloud`-class descriptor path. `fetch` and non-auth headers ride the device-local `binding` slot; neither can sit on a descriptor.
- `toRest({ credentials })` — a `StoreCredentialSource` of `kind: 'token'` becomes `Authorization: Bearer <token>`, re-read on **every** request so expiring tokens refresh without rebuilding the store. Takes precedence over an `authorization` key in `headers`; a non-`token` kind throws. The existing static-`headers` path is unchanged.
```

For the remaining 13 stores, add a bare `## 0.5.0` heading under the package heading with a single line:

```markdown
## 0.5.0

- Version alignment only — no functional change in this release.
```

- [ ] **Step 5: Full-repo gate**

Run: `pnpm install && pnpm check:architecture && pnpm build && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green. `pnpm install` refreshes the lockfile after the version bumps — commit it if it changed.

- [ ] **Step 6: Screen the diff**

```bash
git diff | grep -in "accounting\|co-authored\|generated with" | head
```

Expected: no output. Any hit must be removed before committing.

- [ ] **Step 7: Commit and open PR C**

```bash
git add -A
git commit -m "chore: release v0.5.0"
git push -u origin release/0.5.0
```

Open the PR titled `chore: release v0.5.0`. Body summarises: clean-tier descriptors for four stores, the R2 breaking change with its migration snippet, and that the minor bump is driven by the break.

- [ ] **Step 8: STOP — do not publish**

Publishing happens by creating a GitHub Release, which triggers `release.yml`. **This requires explicit user confirmation.** Do not create the release, do not run `workflow_dispatch`, do not run `npm publish`. Report that PR C is open and await instruction.

---

## Post-Merge Follow-Ups (not part of this plan)

- Tiers 2 and 3 of #58 — the opaque-client stores and the `to-nfs`/`to-drive` binding-slot stores — each need their own spec.
- The `@next` dist-tag on `@noy-db/to-*` reads `0.3.0-pre.5` while `latest` is ahead of it. A 0.5.0 stable release does not fix this; the tag needs moving separately.
