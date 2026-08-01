# Hub 0.4.0 Adoption + tx() Contract Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adopt noy-db hub 0.4.0 stable, make every `tx()` implementation honor the atomic
`expectedVersion` contract (issues #36 turso-sibling #37, new dynamo impl #41), mirror the
behavioral conformance tests (#40), extend the docs-bridge payload (#39), and prep a stable
0.3.0 release (#42).

**Architecture:** Each store binds only `@noy-db/hub/to`. `tx(ops)` must be all-or-nothing
with per-op `expectedVersion` CAS enforced atomically; mismatch → `ConflictError`, zero
writes. For batch-API stores (D1, libSQL) the trick is *guard statements that raise an SQL
error inside the atomic batch* (a conditional zero-row update cannot abort a batch). For
DynamoDB it's `TransactWriteItems` with per-item `ConditionExpression`.

**Tech Stack:** pnpm workspace, ESM-only, Node >=22, tsup, vitest, published `@noy-db/hub` 0.4.0.

## Global Constraints

- Hub peer range: `"^0.3.0 || ^0.4.0"` in all 16 `to-*/package.json`; dev pin exact `"0.4.0"`.
- `store.tx(ops)` commits every TxOp atomically — all or nothing. Every `op.expectedVersion`
  enforced atomically alongside the write; mismatch throws `ConflictError` (signature:
  `new ConflictError(currentVersion: number, message?: string)`), whole batch fails, zero applied.
- `capabilities.txAtomic` ⇔ `tx()` implemented (conformance biconditional).
- TDD: new behavior = failing test first. ESM-only. No crypto imports in stores.
- NO Claude/Anthropic attribution in commits/PRs/CHANGELOGs. Never reference the pilot client.
- NEVER publish or run publish-adjacent commands without explicit user confirmation (#42 stops
  and asks; creating a GitHub Release IS publish-adjacent).
- One PR per issue, in order: #38 → #36 → #37 → #40 → #39 → #41 → #42-prep. Merge each after
  CI green before starting the next (each later task depends on the previous being on main).
- `test-support/src/index.ts` must stay authorable as byte-identical with noy-db's
  `test-harnesses/adapter-conformance/src/index.ts` — no repo-local references in new tests.
- Semantics decision (documented deviation): tx() CAS is STRICT — `expectedVersion: 0` means
  "must not exist"; `expectedVersion: N>0` means "must exist at exactly v=N" (missing row = conflict).
  This matches to-turso's `put()` CAS and the hub's #906 preflight→commit window purpose. The
  shared harness only asserts the universal subset (mismatch on an *existing* row), so laxer
  legacy `put()` semantics elsewhere stay untouched.

## Verified facts (from exploration — do not re-derive)

- Published: `@noy-db/hub@0.4.0` is `@latest`; `0.4.0-pre.12` is `@next`.
- All 16 stores peer `"^0.3.0 || ^0.4.0-pre.10"`, dev-pin `"0.4.0-pre.11"`; `test-support` dev-pins `0.4.0-pre.11`.
- `TxOp = { type: 'put'|'delete', vault, collection, id, envelope?, expectedVersion? }` (all readonly).
- tx() implemented today by: to-cloudflare-d1 (batch, NO CAS — #36), to-turso (batch path NO CAS — #37;
  sequential fallback has CAS on put leg only), to-sqlite / to-postgres / to-mysql (sequential inside
  BEGIN/ROLLBACK, CAS honored — already compliant), to-supabase (inherits toPostgres). to-aws-dynamo: none (#41).
- Mocks: pg mock models BEGIN/COMMIT/ROLLBACK with snapshot restore; **mysql mock treats ROLLBACK
  as a no-op** — must gain snapshot semantics in #40 or to-mysql fails the new rollback tests.
  D1/turso conformance run on real `node:sqlite` engines whose `batch()` = BEGIN…COMMIT/ROLLBACK.
- docs-bridge payload already carries `capabilities` wholesale; the missing piece (#39) is an explicit
  per-package `txAtomic: true | false | 'conditional' | null` matching noy-db-docs' scanner vocabulary
  (`registry/scan-to-capabilities.mjs`: literal true/false; `'conditional'` = non-literal declaration,
  e.g. turso; `null` = vault-shaped). Their matrix renders only record/vault/casAtomic/txAtomic ⇒
  txAtomic is the only rendered-but-unkeyed bit (audit conclusion). Their `parseBridge` validates only
  `{bridge:1, packages:[...]}` so an additive field is non-breaking.
- Harness byte-identity verified against sibling `../noy-db` checkout; `pnpm check:harness` compares it.
- Fake dynamo models `PutCommand` condition `'#v = :expected OR attribute_not_exists(pk)'`,
  Get/Delete/Query. No transact support yet.

---

### Task 1: #38 — Adopt hub 0.4.0 stable

**Files:**
- Modify: all 16 `to-*/package.json` (peerDependencies + devDependencies `@noy-db/hub`)
- Modify: `test-support/package.json` (devDependencies `@noy-db/hub`)
- Modify: `pnpm-lock.yaml` (via install)
- Modify: all 16 `to-*/CHANGELOG.md` (adoption entry, matching the 0.3.0-pre.1 precedent)

**Interfaces:** Produces: workspace resolving published `@noy-db/hub@0.4.0` for all later tasks.

- [ ] **Step 1: Branch** — `git checkout -b chore/adopt-hub-040`
- [ ] **Step 2: Widen ranges + pins.** In every `to-*/package.json`: peer `"^0.3.0 || ^0.4.0-pre.10"` → `"^0.3.0 || ^0.4.0"`, dev pin `"0.4.0-pre.11"` → `"0.4.0"`. Same dev pin in `test-support/package.json`.

```bash
perl -pi -e 's/"\^0\.3\.0 \|\| \^0\.4\.0-pre\.10"/"^0.3.0 || ^0.4.0"/; s/"@noy-db\/hub": "0\.4\.0-pre\.11"/"\@noy-db\/hub": "0.4.0"/' to-*/package.json test-support/package.json
git diff --stat   # expect 17 files
```

- [ ] **Step 3: Install** — `pnpm install`. Verify: `ls node_modules/.pnpm | grep '@noy-db+hub@0.4.0'` shows `@noy-db+hub@0.4.0` (no `-pre`).
- [ ] **Step 4: Full verify** — `pnpm test && pnpm check:architecture && pnpm lint && pnpm typecheck && pnpm build`. Expected: all green (the `/to` seam is unchanged in shape).
- [ ] **Step 5: CHANGELOG entries.** Add to the top of each of the 16 `to-*/CHANGELOG.md` (below the `# @noy-db/to-*` title line):

```markdown
## 0.3.0

### Hub 0.4.0 stable adopted ([#38](https://github.com/vLannaAi/noy-db-to/issues/38))

- `peerDependencies["@noy-db/hub"]` → `^0.3.0 || ^0.4.0`, dev pin → `0.4.0`. Full conformance re-validated against the published hub 0.4.0 stable (`@latest`), whose `db.transaction(fn)` now genuinely delegates to `store.tx()` on `txAtomic` stores (noy-db#906).
```

- [ ] **Step 6: Commit + PR** — commit `chore: adopt hub 0.4.0 stable — widen peer range, re-pin dev dep (#38)`; push; `gh pr create`; wait CI green; merge; `git checkout main && git pull`.

---

### Task 2: #36 — to-cloudflare-d1: enforce expectedVersion in tx()

**Files:**
- Create: `to-cloudflare-d1/__tests__/tx.test.ts`
- Modify: `to-cloudflare-d1/src/index.ts` (the `tx()` method, ~line 282; docblock capability table)
- Modify: `to-cloudflare-d1/CHANGELOG.md`

**Interfaces:**
- Consumes: `d1OverNodeSqlite()` from `__tests__/_engine.js`; `ConflictError` from `@noy-db/hub/to`.
- Produces: guard-statement pattern that Task 3 mirrors for turso.

- [ ] **Step 1: Branch** — `git checkout -b fix/d1-tx-expected-version`
- [ ] **Step 2: Write failing tests** (`to-cloudflare-d1/__tests__/tx.test.ts`):

```ts
import { describe, expect, it } from 'vitest'
import { ConflictError } from '@noy-db/hub/to'
import type { EncryptedEnvelope } from '@noy-db/hub/to'
import { toCloudflareD1 } from '../src/index.js'
import { d1OverNodeSqlite } from './_engine.js'

// noy-db-to#36 — tx() must enforce every op.expectedVersion atomically inside
// the batch: mismatch throws ConflictError and NOTHING is applied. Runs on a
// real SQLite engine whose batch() is BEGIN…COMMIT/ROLLBACK, same as D1.

function env(v: number, data = 'd'): EncryptedEnvelope {
  return { _noydb: 1, _v: v, _ts: new Date().toISOString(), _iv: 'i', _data: Buffer.from(data).toString('base64') }
}

describe('to-cloudflare-d1 — tx() expectedVersion enforcement (#36)', () => {
  it('commits the batch when every expectedVersion matches', async () => {
    const store = toCloudflareD1({ db: d1OverNodeSqlite() })
    await store.put('v', 'c', 'a', env(1, 'a1'))
    await store.tx!([
      { type: 'put', vault: 'v', collection: 'c', id: 'a', envelope: env(2, 'a2'), expectedVersion: 1 },
      { type: 'put', vault: 'v', collection: 'c', id: 'b', envelope: env(1, 'b1'), expectedVersion: 0 },
    ])
    expect((await store.get('v', 'c', 'a'))?._v).toBe(2)
    expect((await store.get('v', 'c', 'b'))?._v).toBe(1)
  })

  it('throws ConflictError on version mismatch with zero writes applied', async () => {
    const store = toCloudflareD1({ db: d1OverNodeSqlite() })
    await store.put('v', 'c', 'a', env(3, 'a3'))
    await expect(store.tx!([
      { type: 'put', vault: 'v', collection: 'c', id: 'fresh', envelope: env(1, 'f') },
      { type: 'put', vault: 'v', collection: 'c', id: 'a', envelope: env(9, 'stale'), expectedVersion: 1 },
    ])).rejects.toThrow(ConflictError)
    expect(await store.get('v', 'c', 'fresh')).toBeNull()          // zero partial writes
    expect((await store.get('v', 'c', 'a'))?._v).toBe(3)           // target untouched
  })

  it('throws ConflictError when expectedVersion 0 hits an existing row (create-only)', async () => {
    const store = toCloudflareD1({ db: d1OverNodeSqlite() })
    await store.put('v', 'c', 'a', env(1))
    await expect(store.tx!([
      { type: 'put', vault: 'v', collection: 'c', id: 'a', envelope: env(1, 'dupe'), expectedVersion: 0 },
    ])).rejects.toThrow(ConflictError)
  })

  it('enforces expectedVersion on the delete leg too', async () => {
    const store = toCloudflareD1({ db: d1OverNodeSqlite() })
    await store.put('v', 'c', 'a', env(2))
    await store.put('v', 'c', 'keep', env(1, 'keep'))
    await expect(store.tx!([
      { type: 'delete', vault: 'v', collection: 'c', id: 'keep' },
      { type: 'delete', vault: 'v', collection: 'c', id: 'a', expectedVersion: 5 },
    ])).rejects.toThrow(ConflictError)
    expect(await store.get('v', 'c', 'keep')).not.toBeNull()       // delete rolled back
  })

  it('a put op missing its envelope fails without partial application', async () => {
    const store = toCloudflareD1({ db: d1OverNodeSqlite() })
    await expect(store.tx!([
      { type: 'put', vault: 'v', collection: 'c', id: 'good', envelope: env(1) },
      { type: 'put', vault: 'v', collection: 'c', id: 'bad' },
    ])).rejects.toThrow()
    expect(await store.get('v', 'c', 'good')).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify failure** — `pnpm vitest run to-cloudflare-d1/__tests__/tx.test.ts`. Expected: mismatch/delete-leg/create-only tests FAIL (no ConflictError thrown, partial writes present); happy-path and missing-envelope PASS.
- [ ] **Step 4: Implement.** Replace `tx()` in `to-cloudflare-d1/src/index.ts`:

```ts
    async tx(ops: readonly TxOp[]) {
      await ensureSchema()
      // Guards run FIRST, inside the same atomic batch as the writes: a
      // conditional UPDATE that matches zero rows cannot abort a D1 batch,
      // so each expectedVersion becomes a statement that RAISES (NOT NULL
      // violation on `v`) exactly when its precondition fails against the
      // pre-batch state — aborting and rolling back the entire batch.
      //   expectedVersion 0  → row must NOT exist
      //   expectedVersion N  → row must exist at exactly v = N
      const guarded = ops.filter(op => op.expectedVersion !== undefined)
      const statements: D1PreparedStatement[] = []
      for (const op of guarded) {
        const clause = op.expectedVersion === 0
          ? `EXISTS (SELECT 1 FROM ${tableName} WHERE vault = ? AND collection = ? AND id = ?)`
          : `NOT EXISTS (SELECT 1 FROM ${tableName} WHERE vault = ? AND collection = ? AND id = ? AND v = ?)`
        const args = op.expectedVersion === 0
          ? [op.vault, op.collection, op.id]
          : [op.vault, op.collection, op.id, op.expectedVersion]
        statements.push(
          db
            .prepare(
              `INSERT INTO ${tableName} (vault, collection, id, v, ts, iv, data)
               SELECT '', '', '', NULL, '', '', '' WHERE ${clause}`,
            )
            .bind(...args),
        )
      }
      for (const op of ops) {
        if (op.type === 'put') {
          if (!op.envelope) throw new Error(`tx put op missing envelope for ${op.id}`)
          statements.push(upsertStatement(op.vault, op.collection, op.id, op.envelope))
        } else {
          statements.push(
            db
              .prepare(`DELETE FROM ${tableName} WHERE vault = ? AND collection = ? AND id = ?`)
              .bind(op.vault, op.collection, op.id),
          )
        }
      }
      try {
        await db.batch(statements)
      } catch (err) {
        // The batch rolled back. Re-probe each guarded op against the (restored)
        // pre-batch state; a mismatch identifies the tripped guard → ConflictError.
        // No mismatch found (e.g. an unrelated SQL error) → rethrow the original.
        for (const op of guarded) {
          const row = await db
            .prepare(`SELECT v FROM ${tableName} WHERE vault = ? AND collection = ? AND id = ?`)
            .bind(op.vault, op.collection, op.id)
            .first<{ v: number }>()
          const conflicted = op.expectedVersion === 0 ? row !== null : row?.v !== op.expectedVersion
          if (conflicted) {
            throw new ConflictError(
              row?.v ?? 0,
              `tx version conflict on ${op.collection}/${op.id}: expected ${op.expectedVersion}, found ${row?.v ?? 'no row'}`,
            )
          }
        }
        throw err
      }
    },
```

Also update the docblock capability table row (line ~25): `` | `txAtomic`  | `true` — `D1Database.batch()` is atomic per-session; per-op `expectedVersion` enforced by in-batch guards | ``

- [ ] **Step 5: Run tests** — `pnpm vitest run to-cloudflare-d1` (tx + conformance + existing). Expected: PASS.
- [ ] **Step 6: CHANGELOG** — under the existing `## 0.3.0` heading (added in Task 1), append:

```markdown
### Fix: tx() now enforces `expectedVersion` atomically ([#36](https://github.com/vLannaAi/noy-db-to/issues/36))

- `tx()` previously ignored `op.expectedVersion` entirely — a concurrent writer between the hub's pre-flight and the batch commit was silently clobbered. Every guarded op now emits an in-batch guard statement that aborts the whole `db.batch()` on mismatch (all-or-nothing), and the store rethrows as `ConflictError`. CAS semantics are strict: `expectedVersion: 0` = create-only, `N` = row must exist at exactly `v = N`.
```

- [ ] **Step 7: Full verify + PR** — `pnpm test && pnpm check:architecture && pnpm lint && pnpm typecheck`; commit `fix(to-cloudflare-d1): enforce TxOp.expectedVersion atomically in tx() (#36)`; PR; CI green; merge; back to main.

---

### Task 3: #37 — to-turso: enforce expectedVersion in the batch path + honest docs

**Files:**
- Create: `to-turso/__tests__/tx.test.ts`
- Modify: `to-turso/src/index.ts` (batch branch of `tx()`, ~line 392; capabilities comment)
- Modify: `to-turso/README.md` (new "Atomicity" note)
- Modify: `to-turso/CHANGELOG.md`

**Interfaces:** Consumes: `libsqlOverNodeSqlite()` from `__tests__/_engine.js`; mirrors Task 2's guard pattern with `{ sql, args }` statement objects.

- [ ] **Step 1: Branch** — `git checkout -b fix/turso-tx-expected-version`
- [ ] **Step 2: Write failing tests** — `to-turso/__tests__/tx.test.ts`, same five cases as Task 2's test file verbatim, with the header import block swapped to:

```ts
import { toTurso } from '../src/index.js'
import { libsqlOverNodeSqlite } from './_engine.js'
```

and every construction `toCloudflareD1({ db: d1OverNodeSqlite() })` → `toTurso({ client: libsqlOverNodeSqlite() })`, describe title `'to-turso — batch tx() expectedVersion enforcement (#37)'`.

- [ ] **Step 3: Verify failure** — `pnpm vitest run to-turso/__tests__/tx.test.ts`. Expected: mismatch/create-only/delete-leg FAIL.
- [ ] **Step 4: Implement.** In the `if (client.batch)` branch of `tx()`: build `guarded` list and guard statements first (same SQL text as Task 2, as `{ sql, args }` objects), then the write statements, then:

```ts
      try {
        await client.batch(statements)
      } catch (err) {
        for (const op of guarded) {
          const check = await client.execute({
            sql: `SELECT v FROM ${tableName} WHERE vault = ? AND collection = ? AND id = ?`,
            args: [op.vault, op.collection, op.id],
          })
          const row = check.rows[0] as { v: number } | undefined
          const conflicted = op.expectedVersion === 0 ? row !== undefined : row?.v !== op.expectedVersion
          if (conflicted) {
            throw new ConflictError(
              row?.v ?? 0,
              `tx version conflict on ${op.collection}/${op.id}: expected ${op.expectedVersion}, found ${row?.v ?? 'no row'}`,
            )
          }
        }
        throw err
      }
      return
```

The sequential fallback branch stays as-is (documented non-atomic, never declares txAtomic).

- [ ] **Step 5: Run** — `pnpm vitest run to-turso`. Expected: PASS (incl. existing txAtomic.test.ts — the guard adds statements, so drop/adjust the exact `statementCounts` assertion there: 3 ops with no expectedVersion still yield 3 statements; that test's ops carry no expectedVersion so it should pass unchanged — verify).
- [ ] **Step 6: Docs honesty.** README.md — add near the capability/usage docs:

```markdown
## Atomicity (`txAtomic`) depends on the injected client

`capabilities.txAtomic` is declared **conditionally at construction**: libSQL's `batch()`
runs its statements in one implicit transaction, so the atomic-batch guarantee is honest
exactly when the client exposes `batch`.

- `client` **with** `batch` (every real `@libsql/client`) → `txAtomic: true`; `tx()` submits
  one batch with in-batch `expectedVersion` guards — all-or-nothing, mismatch throws `ConflictError`.
- `client` **without** `batch` (duck-typed injections) → `txAtomic: false`; `tx()` falls back
  to sequential statements with **no** atomicity guarantee, and the hub will not delegate to it.
- `clientFactory` path → `true` (factory-built clients are real `@libsql/client` instances).
```

Also extend the capabilities-comment in `src/index.ts` (~line 253) with one line noting the batch path enforces per-op `expectedVersion` via in-batch guards (#37).

- [ ] **Step 7: CHANGELOG** — under `## 0.3.0`:

```markdown
### Fix: batch tx() now enforces `expectedVersion` atomically; conditional `txAtomic` documented ([#37](https://github.com/vLannaAi/noy-db-to/issues/37))

- The `client.batch()` path previously ignored `op.expectedVersion` (sibling of #36). Guarded ops now emit in-batch guard statements that abort the whole batch on mismatch → `ConflictError`, zero writes applied. Strict CAS: `expectedVersion: 0` = create-only, `N` = row must exist at `v = N`.
- README now documents that `txAtomic` is client-conditional: batch-capable client ⇒ atomic; the sequential fallback (batch-less injected client) is non-atomic and does not declare the bit.
```

- [ ] **Step 8: Full verify + PR** — commit `fix(to-turso): enforce TxOp.expectedVersion in the batch tx() path; document conditional txAtomic (#37)`; PR; CI; merge.

---

### Task 4: #40 — mirror noy-db#920's behavioral tx() conformance tests

**Files:**
- Modify: `test-support/src/index.ts` (append 3 tests inside the `optional capabilities` describe, after the existing liveness test)
- Modify: `to-mysql/__tests__/_mock.ts` (model ROLLBACK with snapshot restore — required for the new tests)

**Interfaces:** Consumes: nothing repo-local — tests use only `adapter`, `makeEnvelope`, `ConflictError` (byte-identity requirement). Produces: the test block to post on noy-db#920.

- [ ] **Step 1: Branch** — `git checkout -b test/behavioral-tx-conformance`
- [ ] **Step 2: Add the three tests** to `test-support/src/index.ts`, immediately after the `it('tx() applies every op, when implemented', …)` block:

```ts
      it('tx() enforces expectedVersion atomically — mismatch throws ConflictError with nothing applied, when implemented (#920)', async () => {
        if (typeof adapter.tx !== 'function') return
        await adapter.put('comp-txv', 'coll1', 'a', makeEnvelope(2, 'committed'))
        // A matching expectedVersion commits.
        await adapter.tx([
          { type: 'put', vault: 'comp-txv', collection: 'coll1', id: 'a', envelope: makeEnvelope(3, 'updated'), expectedVersion: 2 },
        ])
        expect((await adapter.get('comp-txv', 'coll1', 'a'))?._v).toBe(3)
        // A mismatch throws ConflictError and applies NOTHING — including sibling ops.
        await expect(
          adapter.tx([
            { type: 'put', vault: 'comp-txv', collection: 'coll1', id: 'b', envelope: makeEnvelope(1, 'sibling') },
            { type: 'put', vault: 'comp-txv', collection: 'coll1', id: 'a', envelope: makeEnvelope(9, 'stale'), expectedVersion: 7 },
          ]),
        ).rejects.toThrow(ConflictError)
        expect((await adapter.get('comp-txv', 'coll1', 'a'))?._v).toBe(3)
        expect(await adapter.get('comp-txv', 'coll1', 'b')).toBeNull()
      })

      it('tx() rolls back every op when one leg fails — zero partial writes, when implemented (#920)', async () => {
        if (typeof adapter.tx !== 'function') return
        await adapter.put('comp-txr', 'coll1', 'seed', makeEnvelope(1, 'original'))
        await adapter.put('comp-txr', 'coll1', 'blocker', makeEnvelope(1, 'blocker'))
        await expect(
          adapter.tx([
            { type: 'put', vault: 'comp-txr', collection: 'coll1', id: 'fresh', envelope: makeEnvelope(1, 'fresh') },
            { type: 'delete', vault: 'comp-txr', collection: 'coll1', id: 'seed' },
            { type: 'put', vault: 'comp-txr', collection: 'coll1', id: 'blocker', envelope: makeEnvelope(9, 'clobber'), expectedVersion: 4 },
          ]),
        ).rejects.toThrow()
        expect(await adapter.get('comp-txr', 'coll1', 'fresh')).toBeNull()
        const seed = await adapter.get('comp-txr', 'coll1', 'seed')
        expect(seed?._data).toBe(Buffer.from('original').toString('base64'))
      })

      it('tx() rejects a put op missing its envelope without partial application, when implemented (#920)', async () => {
        if (typeof adapter.tx !== 'function') return
        await expect(
          adapter.tx([
            { type: 'put', vault: 'comp-txe', collection: 'coll1', id: 'good', envelope: makeEnvelope(1, 'good') },
            { type: 'put', vault: 'comp-txe', collection: 'coll1', id: 'bad' },
          ]),
        ).rejects.toThrow()
        expect(await adapter.get('comp-txe', 'coll1', 'good')).toBeNull()
      })
```

- [ ] **Step 3: Run to see which stores fail** — `pnpm test`. Expected: to-mysql conformance FAILS the rollback tests (mock ROLLBACK is a no-op); d1/turso/sqlite/postgres/supabase PASS (fixes from Tasks 2–3 + real engines/snapshot mock).
- [ ] **Step 4: Fix the mysql mock** — give `to-mysql/__tests__/_mock.ts` snapshot semantics mirroring the pg mock: on `START TRANSACTION` capture `txSnapshot = new Map(rowMap)`; on `COMMIT` clear it; on `ROLLBACK` restore `rowMap` entries from the snapshot (clear + repopulate). Mock-fidelity only — no store code change.
- [ ] **Step 5: Full suite green** — `pnpm test`. Expected: PASS across all 16 stores.
- [ ] **Step 6: Cross-repo verification (read-only sibling use).** Copy the updated file over `../noy-db/test-harnesses/adapter-conformance/src/index.ts`, run noy-db's conformance-consuming tests (`cd ../noy-db && pnpm vitest run --project` or the targeted store packages) to confirm the same bytes pass to-memory / to-file / to-browser-idb / to-probe / to-meter, then `git -C ../noy-db checkout -- test-harnesses/adapter-conformance/src/index.ts` to restore. Record the result.
- [ ] **Step 7: Post the finished test block as a comment on noy-db#920** (`gh issue comment 920 --repo vLannaAi/noy-db`), noting byte-identity intent and the sibling verification result. Note in the PR body that `pnpm check:harness` reports advisory drift until noy-db#920 lands the same bytes.
- [ ] **Step 8: Commit + PR** — `test(conformance): behavioral tx() tests — rollback, expectedVersion CAS, missing-envelope (#40)`; PR; CI; merge.

---

### Task 5: #39 — docs-bridge: per-store txAtomic in the payload

**Files:**
- Modify: `scripts/docs-bridge/build-payload.mjs` (+ its `.d.mts` if it declares the package shape)
- Modify: `scripts/__tests__/docs-bridge-payload.test.ts`
- Modify: `docs/superpowers/specs/2026-07-30-docs-bridge-design.md` (payload schema sample)

**Interfaces:** Produces: per-package `txAtomic: true | false | 'conditional' | null` — same vocabulary as noy-db-docs `registry/scan-to-capabilities.mjs`, additive to the payload.

- [ ] **Step 1: Branch** — `git checkout -b feat/bridge-tx-atomic`
- [ ] **Step 2: Failing test.** In `docs-bridge-payload.test.ts`, extend fixtures: `to-alpha` gains `capabilities: { casAtomic: true, txAtomic: true }`; `to-beta` stays without a txAtomic key; add `to-gamma-cond` with `optionDependent: true, capabilities: { casAtomic: true, txAtomic: true }` and `to-delta-vault` with `shape: 'vault', capabilities: null`. Assert per package: alpha `txAtomic === true`, beta `txAtomic === false`, cond `txAtomic === 'conditional'`, vault `txAtomic === null`. Run: expect FAIL (`txAtomic` undefined).
- [ ] **Step 3: Implement** in `buildPayload`'s package mapper:

```js
    // #39 — explicit per-store txAtomic for noy-db-docs' bridge divergence
    // check, in the scanner's vocabulary (scan-to-capabilities.mjs):
    // true/false = literal declaration, 'conditional' = declaration varies
    // with construction options (today: to-turso's client-conditional bit —
    // optionDependent is the wiring's marker for exactly that), null = vault
    // (pod) stores, where NoydbStore capabilities don't apply.
    const txAtomic = cap.shape === 'record'
      ? (cap.optionDependent ? 'conditional' : (cap.capabilities?.txAtomic ?? false))
      : null
```

and add `txAtomic` to the returned object (after `capabilities`).

- [ ] **Step 4: Tests pass** — `pnpm vitest run scripts/__tests__`. Also confirm the audit: matrix renders record/vault/casAtomic/txAtomic only; casAtomic + shape already in payload ⇒ no other omitted bit (state this in the PR body).
- [ ] **Step 5: Consumer coordination.** Verify additive safety against noy-db-docs' actual reader: run `node --test` (or their vitest equivalent) on `../noy-db-docs/scripts/sync/bridge.test.mjs` unchanged, and feed a sample new-shape payload through their `parseBridge`/`classifyBridge`/`checkBridgeDivergence` in a scratch script — expect no throw, divergence check unaffected. Comment on noy-db-to#39 documenting the field's shape + vocabulary so noy-db-docs#168's follow-up can extend `checkBridgeDivergence`.
- [ ] **Step 6: Spec doc.** Update the payload sample in `docs/superpowers/specs/2026-07-30-docs-bridge-design.md` to include `"txAtomic": true` in the package object with a one-line vocabulary note.
- [ ] **Step 7: Commit + PR** — `feat(docs-bridge): emit per-store txAtomic in the release payload (#39)`; PR; CI; merge.

---

### Task 6: #41 — to-aws-dynamo: tx() via TransactWriteItems

**Files:**
- Create: `to-aws-dynamo/__tests__/tx.test.ts`
- Modify: `to-aws-dynamo/src/index.ts` (add `tx()`, declare `txAtomic: true`, docblock table + IAM note)
- Modify: `to-aws-dynamo/__tests__/_fake-dynamo.ts` (model `TransactWriteCommand`)
- Modify: `to-aws-dynamo/CHANGELOG.md`

**Interfaces:** Consumes: `TransactWriteCommand` from `@aws-sdk/lib-dynamodb` (dynamic import, same pattern as Put/Get). Produces: `TX_MAX_OPS = 100` hard ceiling that throws.

- [ ] **Step 1: Branch** — `git checkout -b feat/dynamo-tx`
- [ ] **Step 2: Extend the fake** (`_fake-dynamo.ts`) — add a `TransactWriteCommand` branch: read `input.TransactItems` (each `{ Put: { TableName, Item, ConditionExpression?, ExpressionAttributeNames?, ExpressionAttributeValues? } }` or `{ Delete: { TableName, Key, ConditionExpression?, … } }`). Evaluate ALL conditions against the current `items` map first (`attribute_not_exists(pk)` → fail if the keyed item exists; `#v = :expected` with `#v → '_v'` → fail unless item exists with `_v === :expected`); if any fail, throw `err.name = 'TransactionCanceledException'` with `CancellationReasons = [{ Code: 'ConditionalCheckFailed' | 'None' }, …]` and apply nothing; otherwise apply every put/delete. Unmodelled condition strings throw loudly (existing fake convention).
- [ ] **Step 3: Write failing tests** (`to-aws-dynamo/__tests__/tx.test.ts`) — same five scenarios as Task 2 (happy path incl. `expectedVersion: 0` create, mismatch → ConflictError + zero applied, create-only conflict, delete-leg enforcement, missing envelope) built on `toAwsDynamo({ table: 't', client: fakeDynamo().client })`, plus:

```ts
  it('throws a clear error for batches over 100 ops — never silently splits', async () => {
    const { client } = fakeDynamo()
    const store = toAwsDynamo({ table: 't', client })
    const ops = Array.from({ length: 101 }, (_, i) => ({
      type: 'put' as const, vault: 'v', collection: 'c', id: `id${i}`, envelope: env(1),
    }))
    await expect(store.tx!(ops)).rejects.toThrow(/100/)
  })

  it('declares capabilities.txAtomic', () => {
    const store = toAwsDynamo({ table: 't', client: fakeDynamo().client })
    expect(store.capabilities.txAtomic).toBe(true)
  })
```

- [ ] **Step 4: Verify failure** — `store.tx` is undefined → tests FAIL. Conformance biconditional also starts failing the moment `txAtomic: true` lands without `tx()` — implement both together.
- [ ] **Step 5: Implement `tx()`** in the returned store object:

```ts
    async tx(ops) {
      // TransactWriteItems hard ceiling. Splitting would break atomicity, so
      // over-limit batches THROW (the hub treats any tx() throw as
      // nothing-applied, which TransactWriteItems guarantees). The 4 MB
      // aggregate request limit surfaces as an SDK ValidationException.
      if (ops.length > 100) {
        throw new Error(
          `to-aws-dynamo: tx() batch of ${ops.length} ops exceeds DynamoDB's TransactWriteItems limit of 100 — split the transaction at the application level or use a store without this ceiling`,
        )
      }
      const client = await getClient()
      const { TransactWriteCommand } = await import('@aws-sdk/lib-dynamodb') as { TransactWriteCommand: new (input: { TransactItems: unknown[] }) => unknown }
      const items = ops.map(op => {
        const cond = op.expectedVersion === undefined ? {} : op.expectedVersion === 0
          ? { ConditionExpression: 'attribute_not_exists(pk)' }
          : {
              ConditionExpression: '#v = :expected',
              ExpressionAttributeNames: { '#v': '_v' },
              ExpressionAttributeValues: { ':expected': op.expectedVersion },
            }
        if (op.type === 'put') {
          if (!op.envelope) throw new Error(`tx put op missing envelope for ${op.id}`)
          return {
            Put: {
              TableName: table,
              Item: { pk: op.vault, sk: sk(op.collection, op.id), _v: op.envelope._v, _ts: op.envelope._ts, _env: JSON.stringify(op.envelope) },
              ...cond,
            },
          }
        }
        return { Delete: { TableName: table, Key: { pk: op.vault, sk: sk(op.collection, op.id) }, ...cond } }
      })
      try {
        await client.send(new TransactWriteCommand({ TransactItems: items }))
      } catch (err) {
        const cancelled = err instanceof Error && err.name === 'TransactionCanceledException'
        const reasons = (err as { CancellationReasons?: Array<{ Code?: string }> }).CancellationReasons
        const idx = reasons?.findIndex(r => r.Code === 'ConditionalCheckFailed') ?? -1
        if ((cancelled && idx >= 0) || (err instanceof Error && err.name === 'ConditionalCheckFailedException')) {
          const op = ops[Math.max(idx, 0)]!
          const current = await this.get(op.vault, op.collection, op.id)
          throw new ConflictError(
            current?._v ?? 0,
            `tx version conflict on ${op.collection}/${op.id}: expected ${op.expectedVersion}, found ${current?._v ?? 'no item'}`,
          )
        }
        throw err
      }
    },
```

Declare `txAtomic: true` in `capabilities` (with a `// #41 — TransactWriteItems` comment), extend the docblock capability table + IAM minimum permissions (`dynamodb:TransactWriteItems`... actual IAM action is covered by item-level `dynamodb:PutItem`/`DeleteItem`? No — TransactWriteItems requires its own consideration; document per AWS docs the item-level actions suffice for transact operations, verify wording at execution), and TypeScript may need `tx` typed via `NoydbStore` inference (the object literal is `NoydbStore`-returned; TxOp import already needed — add `TxOp` to the type-only import).

- [ ] **Step 6: All green** — `pnpm vitest run to-aws-dynamo && pnpm test` (conformance now runs the #40 behavioral tests against the fake). Expected: PASS.
- [ ] **Step 7: CHANGELOG** — under `## 0.3.0`:

```markdown
### Feature: atomic tx() via TransactWriteItems ([#41](https://github.com/vLannaAi/noy-db-to/issues/41))

- Implements `NoydbStore.tx()` with DynamoDB `TransactWriteItems` and declares `capabilities.txAtomic: true` — hub 0.4.0's `db.transaction(fn)` now delegates its forward commit here. Per-item `ConditionExpression` enforces `op.expectedVersion` (`attribute_not_exists` for `0`, `#v = :expected` otherwise); `TransactionCanceledException`/`ConditionalCheckFailed` maps to `ConflictError` with nothing applied. Batches over DynamoDB's 100-item transaction ceiling throw a clear error rather than silently splitting (splitting would break atomicity); the 4 MB aggregate limit surfaces as the SDK's `ValidationException`.
```

- [ ] **Step 8: Commit + PR** — `feat(to-aws-dynamo): atomic tx() via TransactWriteItems, declare txAtomic (#41)`; PR; CI; merge.

---

### Task 7: #42 — stable 0.3.0 release prep (STOP before publishing)

**Files:**
- Modify: root `package.json` (version `0.3.0-pre.5` → `0.3.0`)
- Modify: all 16 `to-*/package.json` + `test-support/package.json` (version → `0.3.0`)
- Audit: all CHANGELOGs have their `## 0.3.0` sections (Task 1 guarantees the floor)

- [ ] **Step 1: Branch** — `git checkout -b chore/release-0.3.0`
- [ ] **Step 2: Bump versions** — root + 16 stores + test-support to `0.3.0` (lockstep, matching repo convention). `pnpm install` to refresh the lockfile.
- [ ] **Step 3: Full gate** — `pnpm install && pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm check:architecture`. All green. Confirm version↔changelog coherence (every store has a `## 0.3.0` section — satisfies the bridge's `updated` classification).
- [ ] **Step 4: Commit + PR** — `chore: release 0.3.0 — first stable on hub 0.4.0 (#42)`; PR; CI; merge.
- [ ] **Step 5: STOP.** Report status and ask the maintainer for explicit go-ahead before creating the GitHub Release (unmarked pre-release checkbox → `@latest` via release.yml `verify` gate). Do NOT create the release or trigger `workflow_dispatch` without confirmation.

---

## Self-Review Notes

- Spec coverage: #38→T1, #36→T2, #37→T3, #40→T4, #39→T5, #41→T6, #42→T7. Cross-repo coordination
  steps (noy-db#920 comment, noy-db-docs verification) embedded in T4/T5.
- Type consistency: guard SQL identical between T2/T3; harness tests use only `adapter`/`makeEnvelope`/
  `ConflictError` (byte-identity safe); dynamo `cond` spread matches fake's modeled expressions.
- Known judgment calls, surfaced to the user in the final report: strict tx-CAS semantics (missing row
  + `expectedVersion N` = conflict); `optionDependent → 'conditional'` store-level heuristic in T5;
  `check:harness` advisory drift until noy-db lands #920; PR-per-issue with sequential merges.
