# Store-locator descriptor adoption — clean tier (#58 slice 1)

**Date:** 2026-08-04
**Issue:** [#58](https://github.com/vLannaAi/noy-db-to/issues/58) — umbrella; this spec covers the first of three tiers
**Depends on:** #56 (landed) / noy-db#945 — the `@noy-db/hub/to` locator seam, published in hub `0.6.0-pre.0`
**Stores in scope:** `to-aws-dynamo`, `to-cloudflare-r2`, `to-browser-local`, `to-rest`

## Context

#56 landed the store-locator seam for two reference stores: `to-webdav` (`lan`) and
`to-aws-s3` (`cloud`). #58 tracks descriptor adoption for the remaining fifteen, split by
difficulty into three tiers. This spec covers the **clean tier** — the four stores whose
address is already a plain serializable object, requiring no restructuring of how the store
locates its backend.

The two harder tiers (opaque-client stores; `to-nfs`/`to-drive` binding-slot stores) are
deliberately out of scope and get their own design pass. Doing the clean tier first proves
the #56 pattern generalises past its two reference implementations at low cost, and gives the
R2 credential deprecation the attention it needs as a genuine breaking change.

## The contract being implemented

From `@noy-db/hub/to`'s `locator.d.ts`, the constraint is type-level, not conventional:

> CREDENTIALLESS BY CONSTRUCTION: no field here may be typed as a function, a
> `StoreCredentialSource`, or a `StoreCredentials` value. Credentials NEVER ride the
> descriptor — they are supplied separately to `StoreLocator.resolve()` at resolve time.

`StoreClass` is a closed union: `'local' | 'browser' | 'lan' | 'cloud'`.

This forces a four-way partition of every store's current single options bag:

| Slot | Holds | Serialized into a pod? |
|---|---|---|
| `address` | Where the backend is | Yes |
| `options` | Serializable tuning | Yes |
| `binding` | Device-local objects — clients, `fetch`, handles | No |
| `credentials` | `StoreCredentialSource`, supplied at `resolve()` | No |

## Architecture

Each store gains an **additive** export set alongside its existing `to<Kind>()` factory,
mirroring `to-webdav/src/index.ts` exactly:

```ts
export interface <Kind>Address              // serializable "where"
export interface <Kind>DescriptorOptions    // serializable tuning; omitted where none exists
export interface <Kind>Binding              // device-local objects; omitted where none exists
export function <kind>StoreDescriptor(address, options?): StoreDescriptor
export const <kind>StoreFactory: StoreFactory
export function register<Kind>Store(locator: StoreLocator): void
```

The factory reconstructs precisely what `to<Kind>()` builds:

```ts
export const <kind>StoreFactory: StoreFactory = (descriptor, opts) => {
  const address = descriptor.address as <Kind>Address
  const options = (descriptor.options ?? {}) as <Kind>DescriptorOptions
  const binding = (opts.binding ?? {}) as <Kind>Binding
  return to<Kind>({ ...address, ...options, /* binding + credentials spread */ })
}
```

Nothing existing is renamed or removed **except** the R2 credential fields (see *R2 breaking
change*). `to<Kind>()` remains the direct-construction path and is unaffected.

## Per-store mapping

| | `to-aws-dynamo` | `to-cloudflare-r2` | `to-browser-local` | `to-rest` |
|---|---|---|---|---|
| **kind** | `aws-dynamo` | `cloudflare-r2` | `browser-local` | `rest` |
| **class** | `cloud` | `cloud` | `browser` | `cloud` |
| **address** | `{ table, region?, endpoint? }` | `{ bucket, accountId?, prefix?, endpoint? }` | `{ prefix? }` | `{ baseUrl }` |
| **options** | *(none)* | `{ clockUncertaintyMs? }` | `{ obfuscate?, clockUncertaintyMs? }` | `{ timeoutMs? }` |
| **binding** | `{ client? }` | `{ client? }` | *(none)* | `{ fetch?, headers? }` |
| **credentials** | pass-through | pass-through | *(none)* | `kind: 'token'` → bearer |

Notes on specific decisions:

- **`to-aws-dynamo` takes no `options` parameter.** It has no serializable tuning today, and an
  empty options bag would be speculative. `dynamoStoreDescriptor(address)` is a one-argument
  function; adding an optional second parameter later is a non-breaking extension.
- **`to-browser-local` has neither binding nor credentials.** Its factory ignores both `opts`
  fields. It is the simplest store in the tier and serves as the `browser`-class reference.
- **`to-cloudflare-r2`'s `endpoint` lives in `address`, not `options`** — it selects which
  server the store talks to, which is location, not tuning.

## R2 breaking change

`accessKeyId` and `secretAccessKey` are **removed** from `R2Options`. After this change R2 has
exactly two authentication paths: `credentials` (the broker seam) or `client` (injected,
always wins).

Rationale: the descriptor path cannot offer the plaintext pair without violating the
credentialless rule, so leaving it on `toCloudflareR2()` would mean two auth stories diverging by
construction path — and the plaintext pair is the one at odds with the family's
zero-knowledge posture.

**No capability is lost.** Migration is a wrapper:

```ts
// before
toCloudflareR2({ bucket, accountId, accessKeyId, secretAccessKey })

// after
toCloudflareR2({ bucket, accountId, credentials: async () => ({
  kind: 'aws', accessKeyId, secretAccessKey,
}) })
```

Touched by the removal:
- `to-cloudflare-r2/src/index.ts` — the two fields, the validation block and its error message
  (currently at `:119`), and the README example in the module docblock (currently at `:29`)
- `to-cloudflare-r2/__tests__/credentials.test.ts`
- `to-cloudflare-r2/__tests__/to-cloudflare-r2.test.ts`

The new validation error must name `credentials` and `client` as the two remaining paths and
must not reference the removed fields.

## `to-rest` auth

`to-rest` is the only store in the tier whose existing options violate the credentialless rule
twice: `fetch` is a function, and `headers` is where `authorization: Bearer …` lives today.
Its options are therefore partitioned rather than forwarded.

`credentials?: StoreCredentialSource` is added to `RestStoreOptions` itself — additive, and it
keeps the direct and descriptor paths behaving identically rather than special-casing the
factory.

Header assembly moves from construct-once to **per-request**, in this precedence order (later
wins):

```
{ content-type }              always
  → RestStoreOptions.headers  direct-construction callers
  → binding.headers           descriptor path only, merged in by the factory
  → authorization             derived from credentials, when supplied
```

Note the two headers slots live in different namespaces and never collide in the descriptor:
the descriptor's serializable `options` slot is `{ timeoutMs? }` **only** and carries no
headers at all. `RestStoreOptions.headers` is the direct-construction field; `binding.headers`
is the descriptor path's device-local equivalent, which the factory merges into the
`RestStoreOptions.headers` it passes to `toRest()`.

Credentials always win over an `authorization` key supplied through either headers slot. This
overlap is deliberate: the headers slots carry non-auth headers (tenant routing, tracing),
while auth rides the broker. The precedence rule makes the overlap deterministic.

A credential of a kind other than `'token'` throws a clear error naming the kind received,
rather than silently sending no authorization.

Per-request resolution is what makes expiring tokens work, matching how `to-turso` and
`to-aws-s3` already consume the broker seam. This is a behavioural improvement to `to-rest`
independent of the locator work.

## Testing

Every store gets `__tests__/locator.test.ts` modelled on `to-webdav/__tests__/locator.test.ts`:

1. **Round-trip** — `descriptor` → `locator.resolve()` → a store that completes a real
   `put`/`get` cycle.
2. **Serializable and credentialless** — `JSON.parse(JSON.stringify(d))` equals `d`, plus an
   exact deep-equal on the full descriptor shape. This assertion is the credentialless guard:
   a leaked function or secret changes the shape and fails.
3. **Unregistered kind throws** — `resolve()` on a bare locator fails loudly.
4. **Full conformance re-run** — `runStoreConformanceTests(...)` against a descriptor-resolved
   store. This is the load-bearing test: it proves the factory built a genuinely equivalent
   store rather than a plausible-looking object.

Additional, beyond the shared shape:

- `to-rest` — header precedence (all four layers), token refresh across successive requests,
  and the non-`'token'` credential-kind error.
- `to-cloudflare-r2` — the two existing test files updated for the removal; a test asserting
  the new validation error when neither `credentials` nor `client` is supplied.

Existing conformance suites for all four stores must continue to pass unchanged — the
descriptor path is additive and must not alter direct-construction behaviour.

## Release shape

Three sequential PRs, so the breaking change stays reviewable and bisectable on its own:

| PR | Content | Version effect |
|---|---|---|
| A | Four descriptors + locator tests | Additive; no bump |
| B | R2 plaintext removal + migration note in the package CHANGELOG | Breaking |
| C | Release **0.5.0**, lockstep across all 17 stores | The bump |

`0.5.0` rather than `0.4.1`: PR B is a genuine break, and this family's pre-1.0 convention puts
breaking changes in the minor.

No `@noy-db/hub` peer range or dev pin changes — the locator seam is already published in the
adopted `0.6.0-pre.1`, and this work consumes it without moving the floor.

## Out of scope

- The opaque-client tier (`to-postgres`, `to-mysql`, `to-supabase`, `to-sqlite`,
  `to-cloudflare-d1`, `to-smb`, `to-ssh`, `to-turso`, `to-icloud`)
- The binding-slot tier (`to-nfs`, `to-drive`)
- Documenting the existing client-override paths in `to-aws-s3`/`to-aws-dynamo` as binding-slot
  citizens (#58 lists this; it belongs with the tier that establishes the convention broadly)
- Any aggregate "register every store" barrel — no consumer has asked for one, and each store
  registering itself keeps the tree-shaking story intact
