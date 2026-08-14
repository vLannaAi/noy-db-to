# @noy-db/to-browser-fs

## 0.6.0-pre.5

### The release path refuses to route a pre-release to `@latest`

- **No functional change to this package.** Its `dist` is byte-identical to `0.6.0-pre.4`; this release carries a repo-level release-integrity guard.
- **Added the pre-release routing guard** ([#97](https://github.com/vLannaAi/noy-db-to/pull/97)). The npm dist-tag was routed entirely by the "Set as a pre-release" checkbox on the GitHub Release form, with nothing refusing a mismatch — so a forgotten tick would publish a pre-release to `@latest`, which is not self-healing (`npm dist-tag` is an account-changing write needing an interactive 2FA OTP, so CI can never repair it). `release.yml` now fails the release when a semver pre-release version is published from a Release not marked as a pre-release. Only that direction is blocked — a stable version on `@next` is recoverable and stays allowed.

  This repo needed it most and had it last: its `@latest` is already broken (all 17 `to-*@0.5.0` versions are deprecated), and a pre-release landing there would add a second, independent defect to the same tag. noy-db-ui, noy-db and klum-db adopted the guard earlier.

Peer range is unchanged: `^0.6.0-pre.0` (`^0.6.0-pre.11` for `to-drive`/`to-icloud`).

## 0.6.0-pre.4

### Release-integrity work — no change to published code

- **No functional change to this package.** Its `dist` is byte-identical to `0.6.0-pre.3`; this release carries repo-level release-integrity work and exists to bring the registry back in step with `main`.
- **The peer-floor guard now gates releases** ([#94](https://github.com/vLannaAi/noy-db-to/pull/94)). It was triggered only on `pull_request`/`push`, which a `release` event never matches — so a release could publish a peer range the guard would have rejected. It is now a `workflow_call` from `release.yml`, checked out at the release tag, and `publish` depends on it.
- **Three defects fixed in the guard's range analysis** ([#95](https://github.com/vLannaAi/noy-db-to/pull/95)). `semver.minVersion` throws on a malformed range, returns null on an unsatisfiable one, and floors an unbounded range (`*`, `x`, blank) at `0.0.0` — a version no `@noy-db` package has published. Only the null case was handled. All three now fail fast and name the package.
- **The docs-bridge store table is derived, not counted** ([#93](https://github.com/vLannaAi/noy-db-to/pull/93), [#94](https://github.com/vLannaAi/noy-db-to/pull/94)). A missing entry previously made the bridge throw while the release still reported success; the expected set is now read from the `to-*` directories, and a bridge failure writes a loud block to the run summary.

Peer range is unchanged: `^0.6.0-pre.0` (`^0.6.0-pre.11` for `to-drive`/`to-icloud`, which need a generic `StoreLocator.register()`).

## 0.6.0-pre.3

### Peer range narrowed to the versions that actually work ([#89](https://github.com/vLannaAi/noy-db-to/issues/89), [#90](https://github.com/vLannaAi/noy-db-to/pull/90))

- **Unchanged** at `^0.6.0-pre.0`. This store shipped with an honest floor, so the repo-wide correction did not touch it — recorded here because the *guarantee* changed family-wide even where the string did not.

  The family rule is *widen by appending*, which assumes compatibility only grows. It does not: adopting a symbol that exists only from a given upstream version silently retracts the older branches, and no gate notices. **Narrowing is the honest correction.**

### Hub 0.6.0-pre.16 adopted ([#87](https://github.com/vLannaAi/noy-db-to/pull/87), [#88](https://github.com/vLannaAi/noy-db-to/pull/88))

- Dev pins → `0.6.0-pre.16` for `@noy-db/hub` and `@noy-db/test-adapter-conformance`, moved as a **unit** — a hub-only bump leaves siblings behind and invites the tree to resolve two copies of the same lockstep line.

## 0.6.0-pre.2

### Initial release — a File System Access sibling to `to-file` ([#81](https://github.com/vLannaAi/noy-db-to/issues/81), [#82](https://github.com/vLannaAi/noy-db-to/pull/82))

- **New package.** Takes a `FileSystemDirectoryHandle` instead of a path, so a browser can read and write a folder the OS has already mounted — an SMB share, a NAS volume, a USB stick. The adapter never speaks a wire protocol: once a volume is mounted, the protocol stops mattering. Chromium-only by construction; Safari's OPFS is origin-private and structurally cannot see a mounted volume.
- **Layout is byte-identical to `@noy-db/to-file`** — `{vault}/{collection}/{id}.json`, pretty-printed, `_`-prefixed collections skipped by `loadAll`. A Node process and a browser can point at the same folder and read each other's writes; asserted by a layout-parity test.
- **Permissions are owned by the adapter.** `requestAccess()` is the only method that ever prompts, so the ~5 s transient user activation can be spent inside a click *before* a vault unlock's PBKDF2 rather than being discovered as a thrown error mid-sync. `access()` reports four states — `granted` / `prompt` / `denied` / `unreachable` — so "click to reconnect" and "off the office network" are distinguishable without string-matching an error. Permission is checked before the volume is probed, since a lapsed grant makes the probe itself throw `NotAllowedError`. Failures arrive as `FsPermissionError` / `FsUnreachableError`.
- **Writes are protected twice.** `createWritable()` stages bytes in a `.crswap` sidecar and swaps on `close()`, so a killed tab cannot leave a torn `{id}.json`; every write is then read back and compared, throwing `FsWriteVerifyError` on the silent short write a swap does not cover (`verifyWrites: false` opts out for bulk `saveAll`). Orphaned sidecars are filtered from `list`, `listPage`, and `loadAll`.
- **`casAtomic: false`.** The hub *refuses* `vault.sequence().next()` against this store rather than degrading it to a racy read-compare-write, so this tier never mints a document number — allocation stays on a CAS-capable primary. Ordinary `expectedVersion` writes degrade to read-compare-write with a TOCTOU window, as on every filesystem-class store.
- `rememberDirectory()` / `recallDirectory()` / `forgetDirectory()` wrap the IndexedDB round-trip that persists a handle across reloads. A `browser-fs` / `lan` store-locator descriptor is included on the opaque-client tier: the handle arrives as `binding.handle`, since it cannot be reconstructed from serialized JSON.
- Verified by the published `@noy-db/test-adapter-conformance` suite plus targeted tests, against an in-memory File System Access fake with settable permission state, an unmount switch, and a write-corruption hook. **Real-hardware verification against a mounted SMB share in Chrome is still outstanding** — CI has neither.
