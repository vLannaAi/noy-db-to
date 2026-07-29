#!/usr/bin/env node
/**
 * scripts/check-harness-sync.mjs — drift alarm for the vendored conformance harness.
 *
 * Run via: pnpm check:harness  (and `--write` to re-sync)
 *
 * ## Why this file exists
 *
 * `test-support/src/index.ts` is a COPY of noy-db's
 * `test-harnesses/adapter-conformance/src/index.ts`, not a dependency on it.
 * That copy exists because the upstream harness is `private: true` and has never
 * been published, while this repo's architecture law is that it consumes noy-db
 * only through published packages (see CLAUDE.md). A copy was the only option.
 *
 * The copy then did what copies do. It silently fell 48 lines behind, missing the
 * whole `optional capabilities` block from noy-db#884 — including the
 * *implemented ⇒ declared* pairing rule, which is exactly the rule that would
 * have caught the `to-turso` bug in #22 automatically instead of by hand.
 *
 * ## What this checks
 *
 * Byte equality. That is a legitimate check here, not a brittle one: both files
 * import from the PUBLISHED `@noy-db/hub/to` seam, so the harness needs no
 * per-repo adaptation, and the copy has never carried a local modification. Any
 * difference is therefore drift, by definition — there is no legitimate reason
 * for these files to differ.
 *
 * If that ever stops being true — if this repo genuinely needs a local variant —
 * delete this script rather than weakening it into a fuzzy comparison. A drift
 * check that tolerates drift is worse than none, because it reports success.
 *
 * ## Why not just depend on the package
 *
 * That is the better end state and it is tracked upstream. It needs noy-db to
 * flip the harness public, move it into the release machinery (it sits in
 * `test-harnesses/`, outside `scripts/release.mjs`'s walk), give it a build, and
 * promote `vitest` from devDependency to peer. Until someone wants that, this
 * script buys the property that actually matters — drift is loud — for a
 * fraction of the cost.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const VENDORED = resolve(ROOT, 'test-support/src/index.ts')
const UPSTREAM = resolve(ROOT, '../noy-db/test-harnesses/adapter-conformance/src/index.ts')

const write = process.argv.includes('--write')

if (!existsSync(UPSTREAM)) {
  // A sibling checkout is not guaranteed — in CI, or for a contributor who only
  // cloned this repo. Skip rather than fail: this check can only ever be
  // advisory, and a hard failure here would block work it cannot help with.
  console.log('[harness-sync] SKIPPED — no sibling noy-db checkout at ../noy-db')
  console.log('[harness-sync] (clone vLannaAi/noy-db alongside this repo to enable the check)')
  process.exit(0)
}

const upstream = readFileSync(UPSTREAM, 'utf8')
const vendored = existsSync(VENDORED) ? readFileSync(VENDORED, 'utf8') : ''

if (upstream === vendored) {
  console.log('[harness-sync] ✓ test-support/src/index.ts matches noy-db upstream')
  process.exit(0)
}

if (write) {
  writeFileSync(VENDORED, upstream, 'utf8')
  console.log('[harness-sync] re-synced test-support/src/index.ts from noy-db')
  console.log('[harness-sync] review the diff and run the suite — upstream may have added a rule your stores now fail')
  process.exit(0)
}

// Report enough to judge whether this is a new rule or a removal.
const names = (src) => (src.match(/(?:describe|it)\('[^']+'/g) ?? []).map(s => s.replace(/^(?:describe|it)\('/, ''))
const up = names(upstream)
const ven = names(vendored)
const added = up.filter(n => !ven.includes(n))
const removed = ven.filter(n => !up.includes(n))

console.error('\n[harness-sync] DRIFT — the vendored conformance harness differs from noy-db upstream.\n')
console.error(`  upstream : ${upstream.split('\n').length} lines`)
console.error(`  vendored : ${vendored.split('\n').length} lines`)
if (added.length) {
  console.error(`\n  Upstream has ${added.length} test(s) this repo does not run:`)
  for (const n of added.slice(0, 20)) console.error(`    + ${n}`)
  if (added.length > 20) console.error(`    … and ${added.length - 20} more`)
}
if (removed.length) {
  console.error(`\n  This repo runs ${removed.length} test(s) upstream does not — unexpected, the copy should have no local additions:`)
  for (const n of removed.slice(0, 20)) console.error(`    - ${n}`)
}
console.error('\n  Fix:  pnpm check:harness --write   (then run the suite — new rules may fail real stores)\n')
process.exit(1)
