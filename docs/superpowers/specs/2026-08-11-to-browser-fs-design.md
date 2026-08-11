# `@noy-db/to-browser-fs` — a File System Access sibling to `to-file`

**Date:** 2026-08-11
**Issue:** [#81](https://github.com/vLannaAi/noy-db-to/issues/81)
**Status:** approved, ready to implement

## Why

A browser SPA cannot reach a mounted network share. Mounting `Z:\` grants the OS a path;
no web API takes a filesystem path. `@noy-db/to-file` already describes this use case —
"local disk, USB sticks, or network drives" — but it is `node:fs` and `engines: node >= 22`,
so a page cannot load it.

The File System Access API closes the gap: `showDirectoryPicker()` yields a
`FileSystemDirectoryHandle` the page can read and write, and the handle may point at a
mounted SMB volume. The OS already solved the protocol question, so this adapter never
speaks SMB, NFS, or WebDAV — it speaks *directory handle*.

This unlocks the tier-2 slot in a layered topology: `to-browser-idb` authoritative for
writes, a mounted LAN share as `sync-peer`, cloud stores as tier 3.

Chromium-only is accepted. Safari's OPFS is origin-private and structurally cannot see a
mounted volume, so there is no cross-browser design to want.

## Non-goals

- Firefox / Safari support.
- Speaking SMB, NFS, or any wire protocol. `to-smb`, `to-nfs`, `to-ssh` cover those from Node.
- Origin-private filesystem (OPFS). A separate concern, and useless for share interop.
- Making sequence allocation safe on a file share. See *CAS* below — the hub already
  refuses it, which is the correct outcome.

## Package

Flat package `to-browser-fs/` at the repo root, published as `@noy-db/to-browser-fs`.
Skeleton copied from `to-browser-local`: tsup, vitest with `happy-dom`, `eslint src/`,
ESM-only.

- Binds `@noy-db/hub/to` and nothing else (enforced by `scripts/check-architecture.mjs`).
- `peerDependencies`: `@noy-db/hub` at `^0.6.0-pre.0`. A new package needs no historical
  floor; the four-state permission work has no older-hub story.
- `devDependencies`: `@noy-db/hub` and `@noy-db/test-adapter-conformance` at `0.6.0-pre.3`
  (the pin every sibling in this repo currently carries), `happy-dom`, `fake-indexeddb`.
- `version`: `0.6.0-pre.1`, in lockstep with the repo.

> **Publish note (coordination, not silo work):** npm sets `latest` on a package's *first*
> publish regardless of `--tag`. A brand-new package debuting on the pre-release line lands
> on `@latest` too. Flag this at release time from the family-root conversation.

## On-disk layout — byte-identical to `to-file`

```
{root}/
  {vault}/
    {collection}/
      {id}.json        ← EncryptedEnvelope, pretty-printed (2-space), default on
    _keyring/
      {userId}.json
    _sync/
      meta.json
```

`loadAll` skips collections whose name starts with `_`, matching `to-file` and `to-nfs`.
Interop is the point: a Node backup job using `to-file` and a browser using
`to-browser-fs` must read each other's writes against the same folder. This is asserted
directly — a layout-parity test writes the same vault through both shapes and compares.

## Public surface

```ts
toBrowserFs(options: BrowserFsOptions): BrowserFsStore   // NoydbStore & FsAccess

interface BrowserFsOptions {
  readonly handle: FileSystemDirectoryHandle
  readonly pretty?: boolean              // default true — matches to-file
  readonly verifyWrites?: boolean        // default true — see Writes
  readonly name?: string                 // default 'browser-fs'
  readonly clockUncertaintyMs?: number   // default 0
}

interface FsAccess {
  access(): Promise<'granted' | 'prompt' | 'denied' | 'unreachable'>
  requestAccess(): Promise<boolean>
}

class FsPermissionError extends Error   // the grant is missing or was revoked
class FsUnreachableError extends Error  // the volume/handle is not there right now
class FsWriteVerifyError extends Error  // the write landed but read back wrong

rememberDirectory(key: string, handle: FileSystemDirectoryHandle): Promise<void>
recallDirectory(key: string): Promise<FileSystemDirectoryHandle | null>
forgetDirectory(key: string): Promise<void>

browserFsStoreDescriptor(address, options?): StoreDescriptor
browserFsStoreFactory: StoreFactory
registerBrowserFsStore(locator: StoreLocator): void
```

### `NoydbStore` methods implemented

`get`, `put`, `delete`, `list`, `loadAll`, `saveAll` (the 6-method core), plus `ping`,
`getStoreTime`, `listVaults`, `listPage` — the same extension set `to-file` and `to-nfs`
carry. `listSince` is omitted; the hub falls back to `loadAll` + client-side filter.

### Capabilities

```ts
{
  casAtomic: false,
  serverWriteTime: true,
  auth: { kind: 'filesystem', required: true, flow: 'implicit' },
}
```

`required: true` and `flow: 'implicit'` differ from `to-file`'s `false`/`'static'`
deliberately: this store genuinely cannot operate without an interactive grant.

## Permission model

This is the part the issue asks to be designed in rather than bolted on, and it is the
adapter's central responsibility.

**Three problems, three mechanisms:**

1. **Transient user activation.** `requestPermission()` needs a live user gesture
   (~5 s in Chrome). A vault unlock does PBKDF2 and blows past it. Therefore
   **`requestAccess()` is the only method in the package that ever calls
   `requestPermission()`.** No read, write, sync, or `ping` prompts. The consumer spends
   the gesture first, then does the slow work:

   ```ts
   // inside the click handler, BEFORE unlock
   if (await store.access() !== 'granted') {
     if (!await store.requestAccess()) return   // user declined
   }
   await unlockVault(password)                  // slow; activation already spent
   ```

2. **Four states, not two.** `access()` resolves:

   | State | Meaning | What the app should say |
   |---|---|---|
   | `granted` | permission held **and** the root handle responds | connected |
   | `prompt` | no grant yet, or it lapsed on restart | "click to reconnect" |
   | `denied` | the user refused | "reconnect from settings" |
   | `unreachable` | grant held, but the volume does not answer | "off the office network — working locally" |

   Order matters: `queryPermission({ mode: 'readwrite' })` runs **first**, and the liveness
   probe runs **only** when that returns `granted`. Probing a dead SMB mount can block for
   seconds; we never pay that when the answer is already known. The two states come from
   two different sources, so they can never be confused, and no consumer ever
   string-matches an error message.

3. **Mid-flight errors are typed.** A `NotAllowedError` from any FSA call maps to
   `FsPermissionError`. A failure to resolve the *root* handle maps to
   `FsUnreachableError`. A `NotFoundError` on a record path while the root is alive is not
   an error at all — it is a missing record, and `get()` returns `null` per the contract.

**Does the grant survive a browser restart?** We have *not* measured this on a real Chrome
+ SMB deployment, and the README must not claim we have. Documented Chromium behavior is
that a handle recalled from IndexedDB keeps its identity but its permission drops back to
`prompt` across a browser restart, with installed PWAs able to hold a persistent grant.
Plan the demo script for **"once per session"** and treat anything better as a bonus. The
four-state API is what makes either outcome survivable: the app opens with a single
"Reconnect LAN share" button instead of discovering the problem as a thrown error
mid-sync. Confirming the exact behavior is part of the reporter's real-hardware
acceptance run.

## Writes — swap plus verify

Two layers, both requested:

1. **Atomic replace.** `FileSystemFileHandle.createWritable()` on a non-OPFS handle writes
   to a `.crswap` sidecar and swaps it into place on `close()`. A torn `{id}.json` is
   structurally impossible; a killed tab leaves an orphan sidecar, never a partial target.
   This gives the browser store the same guarantee `to-smb` gets from `.tmp` + rename —
   and, notably, a stronger one than `to-file` has today (see *Upstream findings*).

2. **Verify after write.** After `close()`, re-read the file and compare against the exact
   serialized text. A mismatch throws `FsWriteVerifyError`. This catches the silent
   short-write / stale-cache failure mode that SMB clients can produce and that the swap
   alone does not cover. Cost is one extra read per write; `verifyWrites: false` turns it
   off for bulk `saveAll` on a trusted link.

**`.crswap` hygiene.** `list`, `listPage`, and `loadAll` filter any entry not ending in
`.json`, so orphaned sidecars from a killed tab are invisible to the store and to sync.

## CAS and sequences — the honest answer

`casAtomic: false`. `put(..., expectedVersion)` degrades to read-compare-write with a
TOCTOU window, throwing `ConflictError` when the read shows a different `_v`. This is the
same guarantee `to-file`, `to-nfs`, `to-smb`, and `to-webdav` give, and SMB client caching
(oplocks/leases) widens the window further.

The issue asks whether filesystem-class stores are safe for sequence allocation. **They are
not, and the hub already enforces that** — `vault.sequence().next()` requires
`casAtomic: true` and raises `StoreCapabilityError` against a store that declares `false`.
So the dangerous case is unreachable by construction: this tier never mints a document
number. Partitioned sequences are not a mitigation that needs building here, because
allocation stays on the tier-1 `to-browser-idb` store where it belongs; the share only ever
carries already-numbered records. The README states this outright so nobody plans around a
capability the store does not have.

Concurrent writes to *different* records are naturally safe — different files, different
directory entries. The residual exposure is the shared objects (`_sequences`, manifests,
`_periods`), which is precisely why they must not be allocated from this tier.

## Handle persistence helper

`FileSystemDirectoryHandle` is structured-cloneable, so it survives in IndexedDB across
reloads. Every consumer writes the same dozen lines; we ship them.

- Database `noydb-to-browser-fs`, object store `handles`, key = the caller's string.
- No dependency beyond the platform `indexedDB` global.
- Deliberately *not* wired into `toBrowserFs()` — the store takes an already-obtained
  handle, so construction stays synchronous and the permission ordering above stays the
  consumer's to control. Recall is a separate, explicit step.

## Store-locator descriptor

Parity with `to-smb`'s opaque-client tier: `kind: 'browser-fs'`, `class: 'lan'`. The
address is identity-only (`label`, optional `path` hint) because a directory handle cannot
be reconstructed from a serialized descriptor — it must be recalled from IndexedDB or
re-picked. `browserFsStoreFactory` therefore requires `binding.handle` at `resolve()` time
and throws a message saying exactly that when it is missing.

## Testing

CI has no Chrome and no SMB share, so the FSA surface is faked.

- **`__tests__/fake-fs.ts`** — an in-memory implementation of the FSA subset used:
  `getDirectoryHandle`, `getFileHandle`, `removeEntry`, `entries`/`values`,
  `createWritable`, `getFile`, `queryPermission`, `requestPermission`. It adds three test
  affordances impossible on a real filesystem: settable permission state, a
  "volume unmounted" switch, and a write-corruption hook.
- **Conformance** — the published `@noy-db/test-adapter-conformance` suite against a fake
  root, mirroring `to-browser-local/__tests__/conformance.test.ts`.
- **Permission** — all four `access()` states; that no method other than `requestAccess()`
  calls `requestPermission()`; that a revoked grant surfaces `FsPermissionError` and an
  unmounted volume surfaces `FsUnreachableError`.
- **Writes** — verify-failure raises `FsWriteVerifyError`; `verifyWrites: false` skips the
  read-back; `.crswap` orphans are invisible to `list`/`listPage`/`loadAll`.
- **Layout parity** — the tree written by the store matches the documented `to-file` paths
  and pretty-printed bytes exactly.
- **Handle helper** — round-trip through `fake-indexeddb`.

Real verification is a Chrome + mounted-SMB run, which the issue reporter has offered to do
against a pre-release on their office network. That is the acceptance step CI cannot
replace.

## Upstream findings — reported on #81, not fixed here

Two facts established while designing this, both belonging to the `noy-db` repo and
therefore to the family-root conversation, not to this silo:

1. **`to-file` does not write temp-then-rename.** Verified against published
   `@noy-db/to-file@0.6.0-pre.3`: `put` is a plain `writeFile`. On a network share with a
   laptop dropping Wi-Fi mid-write, a torn `{id}.json` is reachable. `to-smb` already does
   `.tmp` + rename and documents it, so the pattern exists in the family — `to-file` simply
   does not use it. Worth a `noy-db` issue.
2. **The sequence question has a contract-level answer**, given above: `casAtomic: false`
   means the hub refuses `sequence().next()` rather than degrading it.
