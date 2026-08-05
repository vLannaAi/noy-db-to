# Store-locator adoption — binding-slot tier (#58 slice 3, final)

**Date:** 2026-08-05
**Issue:** [#58](https://github.com/vLannaAi/noy-db-to/issues/58) — tier 3 of 3; closes the umbrella
**Stores (2):** `to-nfs`, `to-drive`
**Plus:** document the client-override paths in `to-aws-s3` / `to-cloudflare-r2` / `to-aws-dynamo` as binding-slot citizens
**Follows:** tier 1 (merged), tier 2 (merged, `docs/superpowers/specs/2026-08-05-store-locator-opaque-client-tier-design.md`)

## What makes this tier different

Tier 2 established that a descriptor is portable identity and the live connection arrives via `binding`. In those nine stores the device-local thing was always one object — an injected client — so `binding.client` unified cleanly.

These two stores are the cases where **device-local state is not a client**. Where an NFS export is mounted differs per machine; which Drive file backs a vault is per-device registry state. That is precisely what the `binding` slot exists for, and it is why these two were held back from tier 2 rather than forced into its shape.

The uniformity rule therefore refines rather than bends:

> **`binding` carries what is device-local, named for what it actually is.** An injected client is `binding.client` — that part is unchanged and `to-drive` follows it. Device-local *configuration* keeps its own name (`mountPath`), because calling a filesystem path `client` would be a lie in service of a pattern.

Everything structural stays identical to tiers 1 and 2: the same six exports, the same guard shape and message style, the same five tests plus the address-forwarding test.

## Per-store design

### `to-nfs` — `kind: 'nfs'`, `class: 'lan'`

Today `toNfs({ mountPath, onNolock?, mountDetector? })` takes only the local mount point, so nothing records *which* export is mounted there. The descriptor fixes that: it carries the logical NFS identity, and the mount point — which is machine-specific — moves to `binding`.

| Slot | Contents | Notes |
|---|---|---|
| `address` | `{ server?, export? }` | The logical `server:/export`. Identity-only — the factory does not consume them; `mountPath` is what the store actually opens. |
| `options` | `{ onNolock? }` | `'warn'` (default) or `'error'`. Serializable tuning. |
| `binding` | `{ mountPath: string; mountDetector? }` | `mountPath` **required** — `toNfs` fails fast without it. `mountDetector` is the existing test-injection seam. |

Guard, matching tier 2's style with the field renamed:

```ts
if (!binding.mountPath) {
  throw new Error(
    '@noy-db/to-nfs: resolving this descriptor requires `binding.mountPath` — ' +
    'where an export is mounted is device-local and never travels in a descriptor. ' +
    'Pass one: locator.resolve(descriptor, { binding: { mountPath } }).',
  )
}
```

### `to-drive` — `kind: 'drive'`, `class: 'cloud'`

`to-drive` has both kinds of device-local state at once: an injected `DriveClient` and a `HandleStore` registry mapping vault ids to Drive file ids. The client follows tier 2's rule; the handle registry is the device-local half #58 calls out.

| Slot | Contents | Notes |
|---|---|---|
| `address` | `{ parentId? }` | Drive parent folder id. Omitted means Drive's `appDataFolder` — the store's existing default, unchanged. |
| `options` | `{ suffix? }` | Bundle filename suffix, default `'.noydb'`. |
| `binding` | `{ client: DriveClient; handles? }` | `client` **required**, mapped onto the store's `drive` option. `handles` is the per-device `HandleStore`; omitted leaves the store's in-memory default. |

`to-drive` returns `NoydbPodStore`, so — exactly as `to-icloud` did in tier 2 — its factory keeps that return type and registers through a documented `as unknown as StoreFactory` cast. **Reuse `to-icloud`'s wording verbatim** so the two pod stores carry one explanation, not two. This is an upstream gap: the hub's `StoreFactory` models `NoydbStore` only. It is not a defect here, and it is worth recording against noy-db.

## Documenting the tier-1 client overrides

`to-aws-s3`, `to-cloudflare-r2` and `to-aws-dynamo` each accept a pre-built client that overrides address-derived construction. That is already binding-slot behaviour; it is simply not described in those terms. Add a sentence to each store's `<Kind>Binding` docstring stating that the injected client is the binding-slot citizen for that store and always wins over address-derived construction. Documentation only — no behaviour changes.

## Testing — per store

Same six as tier 2:

1. Round-trip: descriptor → `resolve()` with the required binding → real `put`/`get` (bundle round-trip for `to-drive`).
2. JSON-serializable + exact-shape `toEqual` — the credentialless guard.
3. Unregistered kind throws.
4. Missing-binding throws the guard error (`binding.mountPath` / `binding.client`).
5. Full conformance suite against a descriptor-resolved store — `to-drive` is a pod store, so follow whatever its existing `__tests__/` already does rather than forcing the plain-store harness.
6. **Address-forwarding test.** For `to-drive`, assert the resolved store actually used the descriptor's `parentId` — against what the injected mock Drive client was really asked for, never a read-back through the store. For `to-nfs`, `server`/`export` are identity-only so there is nothing to forward; assert instead that `binding.mountPath` reaches the store, and record in the report that the address is deliberately not forwarded.

**Mutation check remains a required deliverable.** Delete each binding forward, confirm failure, restore, report counts. This found real gaps in 15 of 15 stores across tiers 1 and 2 — including the reference implementation — so it is not ceremony.

## Out of scope

- Any release. The 0.5.0 bump is held until this tier merges; `main` stays at `0.4.0` and CHANGELOGs use `## Unreleased`. Once #58 closes, the release covering all three tiers can be cut.
- Raising the hub's pod-store `StoreFactory` gap upstream — worth doing, but it belongs in the noy-db repo.

## Execution shape

One batch, both stores plus the three docstring additions, then review. One PR closing #58.
