// check-peer-floor — does every store actually COMPILE against the oldest
// @noy-db/hub its peer range admits?
//
// Why this exists, and why it is separate from check-architecture.mjs:
//
// `hub-peer-range` in check-architecture asserts the peer is *a range*. It
// cannot assert the range is *true*, because truth requires resolving symbols
// out of a hub version that is not installed. Every other gate in this repo —
// build, lint, typecheck, 1717 tests — runs against the DEV PIN, so all of them
// stay green no matter how wrong the declared range is. The dev pin is a proxy
// for the range, and it always answers reassuringly.
//
// That gap shipped twice:
//
//   #89  16 packages advertised ^0.3.0 || ^0.4.0 || ^0.5.0 while importing
//        StoreLocator / StoreDescriptor / StoreFactory, which exist only from
//        0.6.0-pre. `npm i @noy-db/to-postgres @noy-db/hub` satisfied the peer
//        check and then failed to typecheck. The same defect was live on the
//        0.5.0 stable line and had to be repaired by deprecating 17 versions.
//
//   #84  to-drive / to-icloud register a NoydbPodStore factory without a cast,
//        which needs StoreLocator.register() to be generic over both store
//        shapes — landed in 0.6.0-pre.11. SYMBOL PRESENCE DOES NOT CATCH THIS:
//        StoreFactory exists at 0.6.0-pre.0, it just cannot accept the
//        argument. Only compiling against the floor finds it.
//
// So this check COMPILES; it does not grep. That distinction is the whole
// point and should not be optimised away.
//
// Cost: one `pnpm install` per DISTINCT floor (currently two), not per package.
// Intended for CI, not for the lint path — it needs the network.
//
// Usage:  node scripts/check-peer-floor.mjs
//         node scripts/check-peer-floor.mjs --dry-run   (print the plan, install nothing)

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const DRY = process.argv.includes('--dry-run')

// semver is not a direct dependency; resolve it from wherever pnpm put it.
const require = createRequire(import.meta.url)
let semver
try {
  semver = require('semver')
} catch {
  const dir = readdirSync(join(ROOT, 'node_modules/.pnpm')).find((d) => d.startsWith('semver@'))
  if (!dir) {
    console.error('✗ semver not found — add it as a devDependency of the repo root.')
    process.exit(1)
  }
  semver = require(join(ROOT, 'node_modules/.pnpm', dir, 'node_modules/semver'))
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

function storeDirs() {
  return readdirSync(ROOT)
    .filter((d) => d.startsWith('to-'))
    .map((d) => join(ROOT, d))
    .filter((d) => statSync(d).isDirectory() && existsSync(join(d, 'package.json')))
}

// ── Plan: group packages by the minimum hub version their range admits ──────
const groups = new Map() // floor -> [{name, dir, range}]
for (const dir of storeDirs()) {
  const pj = readJson(join(dir, 'package.json'))
  const range = pj.peerDependencies?.['@noy-db/hub']
  if (!range) continue // check-architecture's hub-peer-range already fails this
  const floor = semver.minVersion(range)?.version
  if (!floor) {
    console.error(`✗ ${pj.name}: cannot compute a minimum version from "${range}"`)
    process.exit(1)
  }
  if (!groups.has(floor)) groups.set(floor, [])
  groups.get(floor).push({ name: pj.name, dir, range })
}

console.log(`Peer-floor check — ${groups.size} distinct floor(s) across ${storeDirs().length} stores\n`)
for (const [floor, pkgs] of groups) {
  console.log(`  @noy-db/hub@${floor}`)
  for (const p of pkgs) console.log(`     ${p.name.padEnd(28)} ${p.range}`)
}
console.log()

if (DRY) {
  console.log('--dry-run: nothing installed.')
  process.exit(0)
}

// ── Execute: override hub to each floor in turn and typecheck that group ────
//
// The root pnpm.overrides entry is the least invasive way to force a specific
// hub across the workspace while reusing each package's own tsconfig. The root
// package.json is restored in `finally`, so an interrupted run does not leave a
// pinned override behind.
const rootPath = join(ROOT, 'package.json')
const rootOriginal = readFileSync(rootPath, 'utf8')
const failures = []

const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', env: process.env })

try {
  for (const [floor, pkgs] of groups) {
    console.log(`── installing @noy-db/hub@${floor} …`)
    const pj = JSON.parse(rootOriginal)
    pj.pnpm = { ...(pj.pnpm ?? {}), overrides: { ...(pj.pnpm?.overrides ?? {}), '@noy-db/hub': floor } }
    writeFileSync(rootPath, JSON.stringify(pj, null, 2) + '\n')

    try {
      run('pnpm', ['install', '--no-frozen-lockfile', '--silent'])
    } catch (e) {
      // A floor that cannot even be installed is itself a failed claim.
      failures.push({ floor, pkgs: pkgs.map((p) => p.name), error: `install failed: ${e.stderr || e.message}` })
      continue
    }

    for (const p of pkgs) {
      process.stdout.write(`   typecheck ${p.name.padEnd(28)} `)
      try {
        run('pnpm', ['--filter', p.name, 'typecheck'])
        console.log('ok')
      } catch (e) {
        console.log('FAILED')
        const out = `${e.stdout ?? ''}${e.stderr ?? ''}`
        const errs = out.split('\n').filter((l) => /error TS/.test(l)).slice(0, 4)
        failures.push({ floor, pkgs: [p.name], range: p.range, error: errs.join('\n      ') || out.slice(0, 400) })
      }
    }
  }
} finally {
  writeFileSync(rootPath, rootOriginal)
  try {
    run('pnpm', ['install', '--no-frozen-lockfile', '--silent'])
  } catch {
    console.error('\n⚠  restore install failed — run `pnpm install` before committing.')
  }
}

console.log()
if (failures.length) {
  console.error(`✗ ${failures.length} package(s) do not compile against the floor they advertise:\n`)
  for (const f of failures) {
    console.error(`  ${f.pkgs.join(', ')}  declares "${f.range}"  → floor @noy-db/hub@${f.floor}`)
    console.error(`      ${f.error}\n`)
  }
  console.error('Either narrow the peer range to a floor that works, or restore compatibility')
  console.error('with the older hub. A range that does not compile is a false promise —')
  console.error('consumers hit it as a broken install, not as a refused one.')
  process.exit(1)
}
console.log('✓ every store compiles against the oldest @noy-db/hub its peer range admits')
