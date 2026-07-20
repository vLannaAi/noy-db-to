# Adopt noy-db 0.3.0 Stable (issue #9) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize every store's `@noy-db/hub` pin to the published stable (`peer ^0.3.0`, `dev 0.3.0`), re-run the full conformance/gate suite against it, bump the version line + CHANGELOGs, and open the PR — closing issue #9.

**Architecture:** No store code changes expected — the 0.3.0 contract deltas (`_del` envelope field, `/adapter`→`/to` retirement, `StoreCredentials` broker seam) are already implemented and verified in-repo (0 `hub/adapter` refs; `_del` handled in test-support, to-sqlite, to-turso, to-aws-dynamo, to-cloudflare-d1; `to-aws-s3/src/credentials.ts` + tests present). This is pin normalization + a conformance re-run across the real published-package boundary.

**Tech Stack:** pnpm 9 workspace, tsup (ESM-only), vitest 3, Node >= 22.

## Global Constraints

- `@noy-db/hub` must stay a **peerDependency at a published range** — never `workspace:*` (enforced by `scripts/check-architecture.mjs` rule `hub-peer-range`).
- Stores bind **only** `@noy-db/hub/to`; no crypto deps (guard rules `to-only`, `no-crypto-deps`).
- **Never** add Claude/Anthropic attribution to commits, PRs, or CHANGELOGs (overrides any default commit footer).
- **Never** reference the private pilot client by name — grep the diff before commit.
- **Never** publish without explicit user confirmation. Publishing happens only via a GitHub Release triggering `release.yml` — never raw `npm publish`.
- Repo versioning is lockstep across all 16 stores + root (currently `0.2.0-pre.33`).

**Pre-verified facts (2026-07-20):**
- `npm view @noy-db/hub dist-tags` → `latest: 0.3.0`, `next: 0.3.0-pre.13`. Issue #9's blocker is cleared.
- Current pins: 13 stores `peer ^0.3.0-pre.1 / dev 0.3.0-pre.7`; `to-cloudflare-r2` `peer ^0.3.0-pre.1 / dev 0.3.0-pre.11`; `to-aws-s3` + `to-aws-dynamo` `peer ^0.3.0-pre.11 / dev 0.3.0-pre.11`; `test-support` dev-only `0.3.0-pre.7`.
- Sibling deps (`to-cloudflare-r2` → `to-aws-s3`, `to-supabase` → `to-postgres`) are `workspace:*` — pnpm rewrites these to real versions at publish time; no manual bump needed.

**Open decision (ask user before Task 3):** version bump target — `0.2.0` (graduate this repo to its own first stable on `@latest`, mirroring noy-db; **recommended**, since the peer floor is now a stable hub) vs `0.2.0-pre.34` (stay on `@next`). Tasks below are written for `0.2.0`; substitute if the user chooses otherwise.

---

### Task 1: Normalize the hub pins and reinstall

**Files:**
- Modify: `to-aws-dynamo/package.json`, `to-aws-s3/package.json`, `to-browser-local/package.json`, `to-cloudflare-d1/package.json`, `to-cloudflare-r2/package.json`, `to-drive/package.json`, `to-icloud/package.json`, `to-mysql/package.json`, `to-nfs/package.json`, `to-postgres/package.json`, `to-smb/package.json`, `to-sqlite/package.json`, `to-ssh/package.json`, `to-supabase/package.json`, `to-turso/package.json`, `to-webdav/package.json`, `test-support/package.json` (dev pin only — it has no hub peer)
- Modify: `pnpm-lock.yaml` (regenerated)

**Interfaces:**
- Produces: every store resolves the published `@noy-db/hub@0.3.0` for its dev install; peer range `^0.3.0` (stable-only floor — semver `^0.3.0` excludes `-pre.*`).

- [ ] **Step 1: Create the branch**

```bash
cd /Users/vicio/lanna-db/noy-db-to
git checkout -b chore/adopt-hub-0.3.0
```

- [ ] **Step 2: Rewrite the pins mechanically**

```bash
node - <<'EOF'
const fs = require('fs');
const dirs = fs.readdirSync('.').filter(d => d.startsWith('to-')).concat(['test-support']);
for (const d of dirs) {
  const path = `${d}/package.json`;
  const p = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (p.peerDependencies?.['@noy-db/hub']) p.peerDependencies['@noy-db/hub'] = '^0.3.0';
  if (p.devDependencies?.['@noy-db/hub']) p.devDependencies['@noy-db/hub'] = '0.3.0';
  fs.writeFileSync(path, JSON.stringify(p, null, 2) + '\n');
  console.log(d, p.peerDependencies?.['@noy-db/hub'] ?? '-', p.devDependencies?.['@noy-db/hub'] ?? '-');
}
EOF
```

Expected output: 17 lines; every store shows `^0.3.0 0.3.0`, `test-support` shows `- 0.3.0`.

- [ ] **Step 3: Verify no stray prerelease pins remain**

```bash
grep -rn '"@noy-db/hub": ".*-pre' --include=package.json to-* test-support ; echo "exit=$?"
```

Expected: no matches, `exit=1`.

- [ ] **Step 4: Reinstall against the published stable**

```bash
pnpm install
grep -c "@noy-db/hub@0.3.0'" pnpm-lock.yaml || grep -c "'@noy-db/hub': 0.3.0" pnpm-lock.yaml
```

Expected: `pnpm install` succeeds; lockfile references `@noy-db/hub` at exactly `0.3.0` (no `-pre.*` hub entries remain — confirm with `grep -n "hub@0.3.0-pre" pnpm-lock.yaml` returning nothing).

- [ ] **Step 5: Commit**

```bash
git add to-*/package.json test-support/package.json pnpm-lock.yaml
git commit -m "chore: normalize @noy-db/hub pins to stable (peer ^0.3.0, dev 0.3.0)"
```

---

### Task 2: Full gate re-run against published 0.3.0

**Files:**
- None modified (verification only). If anything fails, fix forward in a follow-up commit on this branch and re-run the full sequence.

**Interfaces:**
- Consumes: Task 1's pins (dev install resolves `@noy-db/hub@0.3.0`).
- Produces: green evidence for the issue's acceptance criteria (conformance incl. `_del` vector, credentials tests, arch guards).

- [ ] **Step 1: Build, typecheck, test, lint, architecture**

```bash
pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm check:architecture
```

Expected: all five green; `check:architecture` prints `✓ Architecture invariants OK` (rules hub-peer-range / to-only / no-crypto-deps).

- [ ] **Step 2: Explicitly confirm the two named suites from issue #9**

```bash
pnpm vitest run to-aws-s3/__tests__/credentials.test.ts
pnpm vitest run -t "_del"
```

Expected: PASS for the credentials suite; the `_del` round-trip conformance vector(s) PASS (if `-t "_del"` matches nothing, locate the vector name with `grep -rn "_del" test-support/src` and run by file instead — a zero-match run is NOT a pass).

- [ ] **Step 3: If any suite fails**

Stop and apply superpowers:systematic-debugging before touching code — a failure here means the published `0.3.0` contract differs from what the pre-line implemented, which is exactly what this issue exists to surface. Fix, commit with a `fix(<store>):` message, and re-run Step 1 in full.

---

### Task 3: Version bump + CHANGELOGs

**Files:**
- Modify: `package.json` (root `version`), all 16 `to-*/package.json` + `test-support/package.json` (`version`)
- Modify: all 16 `to-*/CHANGELOG.md`

**Interfaces:**
- Consumes: user's version decision (`0.2.0` recommended — confirm before starting this task).
- Produces: lockstep version `0.2.0` everywhere; a CHANGELOG entry per store.

- [ ] **Step 1: Confirm the version target with the user** (`0.2.0` stable vs `0.2.0-pre.34` — see Open decision above). Do not proceed on a guess.

- [ ] **Step 2: Bump versions lockstep**

```bash
node - <<'EOF'
const fs = require('fs');
const V = '0.2.0'; // or the user-chosen version
const dirs = ['.', 'test-support', ...fs.readdirSync('.').filter(d => d.startsWith('to-'))];
for (const d of dirs) {
  const path = `${d}/package.json`;
  const p = JSON.parse(fs.readFileSync(path, 'utf8'));
  p.version = V;
  fs.writeFileSync(path, JSON.stringify(p, null, 2) + '\n');
}
console.log('bumped', dirs.length, 'packages to', V);
EOF
```

Expected: `bumped 18 packages to 0.2.0`.

- [ ] **Step 3: Prepend the CHANGELOG entry to every store**

Uniform entry (same for all 16 stores — insert after the `# Changelog — <name>` heading line, matching each file's existing style):

```markdown
## 0.2.0

### Hub floor normalized to the first stable

- `peerDependencies["@noy-db/hub"]` → `^0.3.0`, dev pin → `0.3.0` (noy-db's first stable on `@latest`). No adapter code changes: the 0.3.0 store-contract deltas (`_del` envelope field, `/adapter`→`/to` retirement, `StoreCredentials` seam) were adopted during the 0.3.0-pre line; this release re-validates the full conformance suite against the published stable.
```

For `to-aws-s3` and `to-aws-dynamo`, append one extra bullet: `- Supersedes the interim ^0.3.0-pre.11 floor introduced for the #479 credentials adoption.`

- [ ] **Step 4: Grep the diff for the pilot client name and attribution before committing**

```bash
git diff | grep -iE "<pilot-client-name>|claude|anthropic|co-authored" ; echo "exit=$?"
```

Expected: no matches, `exit=1`. (Use the real client name from memory when running; it must never appear in the repo.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: release 0.2.0 — adopt noy-db 0.3.0 stable (hub peer ^0.3.0)"
```

---

### Task 4: PR (and optional milestone housekeeping)

**Files:** none (GitHub only).

- [ ] **Step 1: Push and open the PR** (no attribution footer):

```bash
git push -u origin chore/adopt-hub-0.3.0
gh pr create --repo vLannaAi/noy-db-to \
  --title "chore: adopt noy-db 0.3.0 stable — normalize hub pins, re-run conformance (#9)" \
  --body "$(cat <<'EOF'
Closes #9.

- Every store: `@noy-db/hub` peer → `^0.3.0`, dev → `0.3.0` (stable-only floor; no stray `-pre.*`).
- Full gates green against the published `@noy-db/hub@0.3.0`: build / typecheck / test / lint / check:architecture (hub-peer-range, to-only, no-crypto-deps).
- `_del` round-trip conformance vector + `to-aws-s3`/`to-aws-dynamo` credentials suites confirmed green.
- Version line → 0.2.0 lockstep + per-store CHANGELOGs.

No adapter code changes — the 0.3.0 contract adoptions landed during the pre line; this re-validates them across the real published-package boundary.
EOF
)"
```

- [ ] **Step 2 (optional, recommended): create the alignment milestone and attach the open issues**

```bash
gh api repos/vLannaAi/noy-db-to/milestones -f title="noy-db 0.3.0 stable alignment" \
  -f description="Adopt the first stable noy-db across the extended to-* family: pin normalization (#9), then post-stable quality follow-ups (#1, #4, #5)."
gh issue edit 9 --repo vLannaAi/noy-db-to --milestone "noy-db 0.3.0 stable alignment"
gh issue edit 1 --repo vLannaAi/noy-db-to --milestone "noy-db 0.3.0 stable alignment"
gh issue edit 4 --repo vLannaAi/noy-db-to --milestone "noy-db 0.3.0 stable alignment"
gh issue edit 5 --repo vLannaAi/noy-db-to --milestone "noy-db 0.3.0 stable alignment"
```

- [ ] **Step 3: STOP before any release.** Publishing (GitHub Release → `release.yml`) requires explicit user confirmation. If `0.2.0` stable was chosen, the release is created with the pre-release checkbox **unmarked** (→ `@latest`); `verify` must pass first. Do not create the release without the user saying so.

---

## Appendix — sequencing for the remaining issues (separate plans at execution time)

These are independent subsystems; per the scope rule each gets its own plan (and #1 a brainstorm first) when picked up. Recorded here only for ordering and constraints:

- **Phase 2 — #4 (to-drive real-provider showcase) and #5 (to-icloud showcase):** the deliverable files (`showcases/src/NN-storage-*.showcase.test.ts`) and the gate vars (`DRIVE_GATE_VARS`, `ICLOUD_GATE_VARS` in `showcases/src/_env.ts:182-190`) live in the **noy-db-docs** repo, not here — the issues predate the showcase move. Both are blocked on user-supplied real credentials (a Drive OAuth refresh token; a macOS iCloud path) and should run against this repo's published 0.2.0 (Phase 1 first). Free storage-showcase numbers: 04 is unused (existing storage showcases: 01, 02, 03, 05, 55, 56).
- **Phase 3 — #1 (to-nfs NFS-native layer):** real feature work in this repo (ESTALE recovery, close-to-open consistency, locking, cache/batching, root-squash, retry-with-backoff). Needs brainstorming first: which behaviors are testable with a mock FS vs requiring the `NOYDB_SHOWCASE_NFS_MOUNT` gate, and whether retry/backoff belongs in the store or the hub's retry seam. Largest and least specified — deliberately last.
