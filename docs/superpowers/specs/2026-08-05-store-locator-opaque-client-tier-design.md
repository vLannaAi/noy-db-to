# Store-locator adoption — opaque-client tier (#58 slice 2)

**Date:** 2026-08-05
**Issue:** [#58](https://github.com/vLannaAi/noy-db-to/issues/58) — tier 2 of 3
**Stores (9):** `to-postgres`, `to-mysql`, `to-supabase`, `to-sqlite`, `to-cloudflare-d1`, `to-turso`, `to-smb`, `to-ssh`, `to-icloud`
**Follows:** tier 1 (`docs/superpowers/specs/2026-08-04-store-locator-clean-tier-design.md`, merged)

## What makes this tier different

Tier 1's stores could be rebuilt from data: `toAwsS3({ bucket, region })` constructs its own client. **None of these nine can.** They have *zero* client-library dependencies — no `pg`, no `mysql2`, no `better-sqlite3`, no `@libsql/client`. The caller injects a live connection and the store just uses it. That is deliberate: it keeps every adapter dependency-free and lets consumers own connection pooling, retries, and TLS.

So the descriptor here cannot be a recipe for constructing a store. It is **portable identity** — *which* database, table, or directory this vault lives in — while the live connection arrives device-side through `binding`. A pod can record "this vault is Postgres table `noydb_envelopes` in schema `public`"; on another device you supply your own client and resolve against it.

Two consequences, both load-bearing:

1. **`binding.client` is REQUIRED**, not an escape hatch. `resolve()` without it must throw a clear error — there is no fallback path to fall back to.
2. **Some address fields are identity-only** and the factory does not consume them (`smb.host`, `ssh.host`). They exist so a persisted descriptor is meaningful to a human and to Studio. This is stated per-field, not left to inference.

## Uniform interface — the point of this tier

Today the injected connection is named **five different ways**: `client` (postgres, mysql, turso, supabase), `db` (sqlite, cloudflare-d1), `smb`, `sftp`, `fs`. The locator layer normalises all of it.

Every store in this tier exports exactly this, with no variation:

```ts
export interface <Kind>Address { … }             // identity — ecosystem-familiar field names
export interface <Kind>DescriptorOptions { … }   // serializable tuning; omitted where none exists
export interface <Kind>Binding { readonly client: <ClientType> }
export function <kind>StoreDescriptor(address, options?): StoreDescriptor
export const <kind>StoreFactory: StoreFactory
export function register<Kind>Store(locator: StoreLocator): void
```

**Rule 1 — the binding field is always `client`.** Whatever the direct API calls it, `<Kind>Binding.client` is the name. The factory maps it onto the store's own field (`client` → `db`, `client` → `sftp`, and so on). One word across these nine stores and the three client-bearing tier-1 stores (`to-aws-s3`, `to-aws-dynamo`, `to-cloudflare-r2`) — `to-rest` and `to-webdav` correctly use `binding.fetch` instead, since a `fetch` function is not a client.

**Rule 2 — the binding is required.** Every factory begins with the same guard and the same message shape:

```ts
if (!binding.client) {
  throw new Error(
    "@noy-db/to-<name>: resolving this descriptor requires `binding.client` — " +
    'this store does not construct its own connection. ' +
    'Pass one: locator.resolve(descriptor, { binding: { client } }).',
  )
}
```

**Rule 3 — addresses read like the ecosystem's standard package.** A Postgres developer should recognise the address without reading our docs.

**Rule 4 — nothing about the existing `to<Kind>()` API changes.** This tier is purely additive. No renames, no deprecations, no behavioural changes.

## Address and options, per store

`table` (not `tableName`) is the address field for every SQL store — it is the word the SQL ecosystem uses, and uniformity across five stores is worth the one-word divergence from each store's own `tableName` option. The factory maps `address.table → tableName`. Where `table` is omitted the store's existing default applies, unchanged.

| Store | `kind` | `class` | `address` | `options` | binding `client` maps to | Familiar from |
|---|---|---|---|---|---|---|
| `to-postgres` | `postgres` | `cloud` | `{ database?, schema?, table? }` | `{ autoMigrate? }` | `client` | `pg` connection config |
| `to-mysql` | `mysql` | `cloud` | `{ database?, table? }` | `{ autoMigrate? }` | `client` | `mysql2` connection config |
| `to-supabase` | `supabase` | `cloud` | `{ projectRef?, schema?, table? }` | `{ autoMigrate? }` | `client` | supabase project ref |
| `to-sqlite` | `sqlite` | `local` | `{ file?, table? }` | `{ autoMigrate? }` | `db` | `better-sqlite3(path)` |
| `to-cloudflare-d1` | `cloudflare-d1` | `cloud` | `{ binding?, database?, table? }` | `{ autoMigrate? }` | `db` | Workers `env.<BINDING>` name |
| `to-turso` | `turso` | `cloud` | `{ url, table? }` | `{ autoMigrate?, clockUncertaintyMs? }` | `client` | `@libsql/client({ url })` |
| `to-smb` | `smb` | `lan` | `{ host?, share?, path? }` | `{ name? }` | `smb` | UNC `\\host\share\path` |
| `to-ssh` | `ssh` | `lan` | `{ host?, port?, path? }` | `{ name? }` | `sftp` | `ssh://host:port/path` |
| `to-icloud` | `icloud` | `local` | `{ folder }` | `{ suffix? }` | `fs` | iCloud Drive folder path |

Notes on individual decisions:

- **`to-turso.url` is required.** #58 flags that the URL is currently captured inside a `clientFactory` closure and is therefore invisible. Putting it on the address is the fix — the descriptor now states which database it refers to. `to-turso` additionally accepts `clientFactory` on its binding (`{ client?, clientFactory? }`) because it is the one store here that *can* build a connection, given a factory plus a credential source; its guard therefore requires `client` **or** `clientFactory`, not `client` alone.
- **`to-smb.host`/`share` and `to-ssh.host`/`port` are identity-only.** The connection lives in the injected handle; these fields make a persisted descriptor legible. Document that on each field.
- **`to-cloudflare-d1.binding`** is the Workers `env` binding name — the thing a D1 user actually identifies a database by. Note the unfortunate collision with our own `binding` slot in the field's docstring.
- **`to-icloud` is a `NoydbPodStore`**, not a plain `NoydbStore`. Its factory's return type must not be narrowed.
- **`to-supabase.projectRef`** rather than a full URL — the ref is the stable identifier and the URL is derivable from it.

## Testing — per store

Same four as tier 1, plus one addition that is now mandatory:

1. Round-trip: descriptor → `resolve()` with `binding.client` → real `put`/`get`.
2. JSON-serializable + exact-shape `toEqual` (the credentialless guard).
3. Unregistered kind throws.
4. **Missing-binding throws** — `resolve()` without `binding.client` produces the Rule 2 error. New for this tier.
5. Full adapter-conformance suite against a descriptor-resolved store.

**Mutation check is a required deliverable, not a review finding.** For each store, delete the line in the factory that forwards `binding.client`, confirm the suite fails, restore. Tier 1 shipped three tests that asserted nothing precisely because this was left to reviewers — the `credentials` path in two stores and `binding.headers` in a third all stayed green when their forwarding was deleted. Report the observed failure per store.

## Out of scope

- Tier 3: `to-nfs` and `to-drive` (per-device binding slot) — own spec.
- Documenting the client-override paths in `to-aws-s3`/`to-cloudflare-r2`/`to-aws-dynamo` as binding-slot citizens — belongs with tier 3, which establishes that convention broadly.
- Any release. The 0.5.0 bump is held until all three tiers land, so `main` stays at `0.4.0` and CHANGELOGs use `## Unreleased`.
- A shared `assertCredentiallessDescriptor()` helper. It would need a new workspace package and a devDependency in every store; the assertion is three lines. Revisit if the copy-paste actually causes drift.

## Execution shape

Three batches, grouped so each batch shares one mental model. One implementer and one review per batch, rather than per store.

| Batch | Stores | Shared shape |
|---|---|---|
| A | `to-postgres`, `to-mysql`, `to-supabase` | SQL, binding maps to `client` |
| B | `to-sqlite`, `to-cloudflare-d1`, `to-turso` | SQL, binding maps to `db` (turso: `client`/`clientFactory`) |
| C | `to-smb`, `to-ssh`, `to-icloud` | filesystem-ish, binding maps to `smb`/`sftp`/`fs` |

One PR for the tier. Every batch ends green on the full-repo gate.
