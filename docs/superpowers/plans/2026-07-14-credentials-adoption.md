# noy-db-to — `credentials` refresh-hook adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax. **Work in the SIBLING repo /Users/vicio/lanna-db/noy-db-to (flat monorepo — packages are at the repo ROOT: to-aws-dynamo/, to-aws-s3/, etc., NOT under packages/).**

**Goal:** Adopt the `credentials` refresh hook (shipped in `@noy-db/hub` 0.3.0-pre.11's #479 credential broker, `StoreCredentials`/`StoreCredentialSource` on `@noy-db/hub/to`) into the AWS stores `to-aws-dynamo` and `to-aws-s3`, bump their hub peer floor to `^0.3.0-pre.11`, and release. This unblocks the full-stack AWS broker showcase (rolling broker credentials → encrypted-vault sync to a real cloud store).

**Architecture:** Ground truth is `.superpowers/sdd/credentials-adoption-ground.md`. The hook is a per-store factory option threaded as a functional AWS SDK credential provider — the hub never calls it; the app wires it. `to-cloudflare-r2` wraps `to-aws-s3`'s `s3()` so it inherits the capability for free (no separate work). Non-adopting stores are untouched (the types are additive; only the adopting stores bump their floor).

**Tech Stack:** TypeScript ESM (Node ≥22), tsup, vitest. `exactOptionalPropertyTypes: true`.

## Global Constraints

- **check-architecture (noy-db-to/scripts/check-architecture.mjs):** `adapter-only` (stores import `@noy-db/hub` only via the `/to` subpath — the `StoreCredentials`/`StoreCredentialSource` types come from `@noy-db/hub/to`), `hub-peer-range` (peer-dep SHAPE — but the floor VALUE bump is a MANUAL correctness gate, not checked), `no-crypto-deps` (credentials are opaque strings, not crypto). Run `pnpm check:architecture` after each task.
- **exactOptionalPropertyTypes:** `mapAws` must use conditional-spread for optional fields (`...(creds.expiresAt ? { expiration: new Date(creds.expiresAt) } : {})`), never `expiration: undefined` — matches how the noy-db repo's `as-aws-s3` did it.
- **CI is mock-based** — no real cloud. The repo has NO `vi.mock` precedent (all current tests inject a pre-built fake `client:`). Credential-hook tests need a new shape: either `vi.mock` the AWS SDK constructor, or export a pure `mapAws` and unit-test it directly (prefer exporting `mapAws` as an internal-testable pure function — simpler, no SDK mocking).
- **A1/A5 discipline:** wire `credentials` as a functional provider `async () => mapAws(await source())` so the SDK's `memoizeIdentityProvider` re-invokes at the rolling window — which REQUIRES `expiration: Date`. Omitting `expiration` silently defeats rolling. No `credentials` option ⇒ NO `credentials` key on the client config ⇒ ambient chain preserved. The pre-built `client?` path is unchanged (an app supplying its own client owns its provider).
- Lockstep versioning (repo at 0.2.0-pre.32 → 0.2.0-pre.33). No changesets tooling — hand-bump versions + hand-write CHANGELOG. No Claude attribution. Never a pilot-client name.

---

### Task 1: `to-aws-dynamo` — `credentials` hook

**Ground:** §1, §4. **Files:** `to-aws-dynamo/src/index.ts` (DynamoOptions + `getClient()` at :108-127), `to-aws-dynamo/__tests__/` (new credential test).

**Interfaces:**
- `DynamoOptions` gains `credentials?: StoreCredentialSource` (import the type from `@noy-db/hub/to`).
- A pure exported-for-test `mapAws(creds: StoreCredentials): AwsCredentialIdentity` — `{ accessKeyId, secretAccessKey, ...(creds.sessionToken ? { sessionToken } : {}), ...(creds.expiresAt ? { expiration: new Date(creds.expiresAt) } : {}) }` (conditional-spread for both optionals under exactOptionalPropertyTypes).

- [ ] **Step 1: failing tests.** Export `mapAws`; test: (V-A0) a `StoreCredentials{kind:'aws', expiresAt: ISO}` → identity with `expiration` a `Date`; missing `expiresAt` → NO `expiration` key (assert `'expiration' in id === false`, matters for the SDK memoize-forever path). (V-A4) when `credentials` is supplied to `dynamo(...)`, `getClient()`'s config carries a functional `credentials` provider; when omitted, config has NO `credentials` key (ambient chain). Use the exported-mapAws + a config-capture approach (the ground doc notes no vi.mock precedent — capture the config object the code would pass, or spy the constructor via a minimal injected seam; prefer testing `mapAws` purely + asserting the config-shape branch). Run → fail (mapAws/option don't exist).
- [ ] **Step 2: implement.** Add the option; in `getClient()` (:117-119, after region/endpoint), `if (options.credentials) config['credentials'] = async () => mapAws(await options.credentials!())`. Pre-built `client?` path unchanged.
- [ ] **Step 3:** run the new test + the existing to-aws-dynamo suite + `pnpm --filter @noy-db/to-aws-dynamo typecheck` + `pnpm check:architecture`. Green.
- [ ] **Step 4: commit** — `feat(to-aws-dynamo): credentials refresh-hook option (rolling store auth via the #479 broker)`.

### Task 2: `to-aws-s3` — `credentials` hook (BOTH client sites)

**Ground:** §1 (the two S3Client sites: `index.ts:91` `s3()` + `bundle.ts:49` `s3Bundle()` — BOTH in scope; omitting bundle.ts is a partial adoption). **Files:** `to-aws-s3/src/index.ts`, `to-aws-s3/src/bundle.ts`, `to-aws-s3/__tests__/`.

**Interfaces:** both `s3()`'s and `s3Bundle()`'s options gain `credentials?: StoreCredentialSource`; a shared `mapAws` (extract to a shared module in the package, e.g. `to-aws-s3/src/credentials.ts`, imported by both sites AND reusable — or duplicate the tiny pure fn if a shared module trips layering; prefer shared).

- [ ] **Step 1: failing tests** mirroring Task 1's V-A0/V-A4, for BOTH `s3()` and `s3Bundle()` — each threads the functional provider into its `new S3Client({...})` via conditional-spread; no option ⇒ no credentials key. Run → fail.
- [ ] **Step 2: implement** on both sites: `...(options.credentials ? { credentials: async () => mapAws(await options.credentials!()) } : {})` inside the `new S3Client({...})` literal. Pre-built `client?` short-circuit unchanged on both.
- [ ] **Step 3:** run the new tests + existing to-aws-s3 suite + typecheck + check:architecture. Green. (Note in report: `to-cloudflare-r2` wraps `s3()` — inherits the capability; confirm its tests still pass, no change needed.)
- [ ] **Step 4: commit** — `feat(to-aws-s3): credentials refresh-hook option on s3() and s3Bundle() (rolling store auth via the #479 broker)`.

### Task 3: peer-floor bump, lockstep version, CHANGELOGs, gauntlet, release prep

**Ground:** §3, §6.

- [ ] **Step 1: peer-floor bump (the manual A3 gate).** In `to-aws-dynamo/package.json` AND `to-aws-s3/package.json`: `peerDependencies["@noy-db/hub"]` `^0.3.0-pre.1` → `^0.3.0-pre.11`; `devDependencies["@noy-db/hub"]` `0.3.0-pre.7` → `0.3.0-pre.11`. (Non-adopting stores keep their pins — the types are additive.) Then `pnpm install` at the repo root to resolve 0.3.0-pre.11 into the lockfile.
- [ ] **Step 2: lockstep version bump.** Bump EVERY `@noy-db/to-*` package.json `version` 0.2.0-pre.32 → 0.2.0-pre.33 (the repo ships lockstep — check how prior bumps were done; a script may exist in `scripts/`, else hand-bump all). Update `to-aws-dynamo` + `to-aws-s3` CHANGELOG.md with the credentials-hook entry (+ hub-floor bump note); a one-line "version bump" entry for the others per the repo's CHANGELOG convention.
- [ ] **Step 3: FULL GAUNTLET** from the noy-db-to repo root: `pnpm install`, `pnpm build` (`pnpm -r build`), `pnpm test` (the stores' conformance vs the PUBLISHED @noy-db/hub — now 0.3.0-pre.11), `pnpm lint`, `pnpm typecheck`, `pnpm check:architecture` (hub-peer-range / adapter-only / no-crypto-deps all pass with the new floor). Report counts. Grep the diff for attribution/client names (zero hits).
- [ ] **Step 4: commit** — `chore: release 0.2.0-pre.33 — AWS stores adopt the credentials refresh hook (hub floor ^0.3.0-pre.11)`. Do NOT publish — the release is a separate user-gated step (GitHub Release / `workflow_dispatch confirm:PUBLISH` per the repo's release.yml). Report the exact publish command for the check-in.

## Self-review notes
- Adoption = Task 1 (dynamo) + Task 2 (s3 both sites); floor bump + lockstep version + release-prep = Task 3.
- bundle.ts's second S3Client site is IN scope (Task 2) — a partial adoption would leave bundle-path syncs without rolling creds.
- Release is user-gated (like every publish in this family) — Task 3 preps it, the check-in asks for the go.
- exactOptionalPropertyTypes conditional-spread on every optional field; `expiration: Date` is load-bearing for the SDK memoizer.
