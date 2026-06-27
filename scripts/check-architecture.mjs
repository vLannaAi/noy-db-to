import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// ARCH_ROOT lets the self-test point the scan at a fixtures dir; default is
// the repo root (one level up from scripts/).
const ROOT = process.env.ARCH_ROOT
  ? resolve(process.env.ARCH_ROOT)
  : resolve(fileURLToPath(import.meta.url), '../..')

let failures = 0
function fail(rule, msg, where) {
  failures++
  console.error(`✗ [${rule}] ${msg}${where ? ` (${relative(ROOT, where)})` : ''}`)
}

// Stores are flat at the repo root: directories named `to-*` with a package.json.
function listStoreDirs() {
  if (!existsSync(ROOT)) return []
  return readdirSync(ROOT)
    .filter(name => name.startsWith('to-'))
    .map(name => join(ROOT, name))
    .filter(p => statSync(p).isDirectory())
    .filter(p => existsSync(join(p, 'package.json')))
}

function readPkg(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
}

function walkTs(dir, cb) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walkTs(p, cb)
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) cb(p, readFileSync(p, 'utf8'))
  }
}

// Rule 1 — hub-peer-range: @noy-db/hub must be a peerDependency at a published
// RANGE; never in dependencies, never a workspace: specifier.
function checkHubPeerRange() {
  for (const dir of listStoreDirs()) {
    const pj = readPkg(dir)
    const dep = pj.dependencies?.['@noy-db/hub']
    const peer = pj.peerDependencies?.['@noy-db/hub']
    if (dep !== undefined)
      fail('hub-peer-range', `${pj.name} has @noy-db/hub in dependencies; it must be a peerDependency range.`, dir)
    if (peer === undefined)
      fail('hub-peer-range', `${pj.name} is missing peerDependencies['@noy-db/hub'].`, dir)
    else if (peer.startsWith('workspace:'))
      fail('hub-peer-range', `${pj.name} peers @noy-db/hub as "${peer}"; cross-repo stores must use a published range (e.g. "^0.2.0-pre.31").`, dir)
    else if (!/^[\^~]?\d/.test(peer))
      fail('hub-peer-range', `${pj.name} peers @noy-db/hub as "${peer}"; expected a semver range.`, dir)
  }
}

// Rule 2 — adapter-only: store src may import @noy-db/hub ONLY via /adapter.
const HUB_IMPORT_RE = /from\s+['"]@noy-db\/hub(\/[^'"]*)?['"]/g
function checkAdapterOnly() {
  for (const dir of listStoreDirs()) {
    const pj = readPkg(dir)
    walkTs(join(dir, 'src'), (file, code) => {
      let m
      const re = new RegExp(HUB_IMPORT_RE.source, 'g')
      while ((m = re.exec(code)) !== null) {
        const sub = m[1] ?? ''
        if (sub !== '/adapter')
          fail('adapter-only', `${pj.name}: imports '@noy-db/hub${sub}' — stores must import only '@noy-db/hub/adapter'.`, file)
      }
    })
  }
}

// Rule 3 — no-crypto-deps: zero npm crypto packages (stores see ciphertext only).
const BANNED = new Set(['crypto-js', 'node-forge', 'tweetnacl', 'bcryptjs', 'bcrypt'])
function checkNoCryptoDeps() {
  for (const dir of listStoreDirs()) {
    const pj = readPkg(dir)
    for (const block of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const name of Object.keys(pj[block] ?? {})) {
        if (BANNED.has(name) || name.startsWith('@noble/') || name.startsWith('@scure/'))
          fail('no-crypto-deps', `${pj.name} depends on crypto package "${name}"; stores see ciphertext only — use @noy-db/hub.`, dir)
      }
    }
  }
}

checkHubPeerRange()
checkAdapterOnly()
checkNoCryptoDeps()

if (failures > 0) {
  console.error(`\n✗ Architecture invariants FAILED (${failures})`)
  process.exit(1)
}
console.log('✓ Architecture invariants OK')
