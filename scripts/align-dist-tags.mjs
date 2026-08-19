#!/usr/bin/env node
/**
 * scripts/align-dist-tags.mjs
 *
 * After a STABLE publish, point `next` at the stable too.
 *
 * ## Why
 *
 * `release.yml` routes an unmarked GitHub Release to `--tag latest`. That sets
 * `latest` to the stable and LEAVES `next` on the last pre-release — and
 * `0.6.0 > 0.6.0-pre.7`, so `@next` ends up BEHIND `@latest`. That is the
 * "lying tag" state the family sweep flags: `@next` is supposed to be the
 * in-flight channel, ahead of or equal to `@latest`, never behind.
 *
 * Aligning both tags on the stable is self-correcting — the next pre-release
 * moves `next` forward again and the normal invariant returns.
 *
 * ## This is the MIRROR of noy-db's scripts/repoint-pre-only-latest.mjs
 *
 * That script moves `latest` for packages that have no stable at all. This one
 * moves `next` for packages that just got one. Read it before changing this —
 * but do NOT copy two of its choices, both deliberate there and wrong here:
 *
 *   1. It carries a HARDCODED package list (`PRE_ONLY`), currently empty, so it
 *      is a no-op until someone remembers to add a name. This repo has the scar
 *      that argues against that: the docs-bridge WIRING table was a hardcoded
 *      list, `to-browser-fs` debuted as the 18th store and was never added, and
 *      the bridge threw on TWO releases while both runs reported success. We
 *      DERIVE the list from the filesystem instead.
 *
 *   2. It never fails its caller, on the reasoning that a wedged tag is
 *      cosmetic and a red release trains people to stop reading logs. That is
 *      right for a pre-only repoint. It is wrong here: a package left behind
 *      leaves `@next` pointing at something older than `@latest`, which is a
 *      wrong answer to `npm i @noy-db/to-x@next`, not a cosmetic one. This
 *      script EXITS NON-ZERO on any failure.
 *
 * ## Usage
 *
 *   node scripts/align-dist-tags.mjs --version=0.6.0 [--dry-run]
 *
 * Requires NODE_AUTH_TOKEN — the CI automation token bypasses 2FA. A
 * workstation `npm dist-tag add` needs an interactive OTP and cannot be
 * scripted. (`npm deprecate` is a DIFFERENT endpoint and has not been tested
 * this way; do not assume it behaves the same.)
 */

import { execFileSync } from 'node:child_process'
import { readdirSync, existsSync, readFileSync, appendFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')

// Importing this module must not read the registry or write a tag. Only the
// pure derivation is exported; everything below `isMain` is the execute half.
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

/** Derived, never transcribed. A new store is covered the day it exists. */
export function publishedPackages() {
  return readdirSync(ROOT)
    .filter(d => d.startsWith('to-') && existsSync(join(ROOT, d, 'package.json')))
    .map(d => JSON.parse(readFileSync(join(ROOT, d, 'package.json'), 'utf8')))
    .filter(pj => pj.private !== true)
    .map(pj => pj.name)
    .sort()
}

/**
 * Decide what to do with one package, from its current dist-tags alone.
 *
 * Pure, and exported ONLY so the refusal can be tested. `latest` must ALREADY
 * be the target: the stable publish sets it, so if it is not there this is
 * running against the wrong `--version`, or before the publish landed. A blind
 * `dist-tag add <pkg>@<version> next` is correct when the stable really
 * published and CATASTROPHIC when the version input is wrong — it would move
 * the in-flight channel onto a version that may not exist.
 *
 * @param {{latest?: string, next?: string}} tags
 * @param {string} version
 * @returns {{action: 'refuse'|'skip'|'move', reason: string}}
 */
export function decideAction(tags, version) {
  if (tags?.latest !== version) {
    return { action: 'refuse', reason: `\`latest\` is ${tags?.latest ?? '<none>'}, expected ${version}. Did the stable publish?` }
  }
  if (tags.next === version) return { action: 'skip', reason: 'already aligned' }
  return { action: 'move', reason: `${tags.next ?? '<none>'} → ${version}` }
}

if (!isMain) { /* imported for the pure helpers — stop here */ } else {

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const version = args.find(a => a.startsWith('--version='))?.slice('--version='.length)

const fail = (msg) => { console.error(`[align] ✗ ${msg}`); process.exitCode = 1 }

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`[align] --version must be a STABLE semver, got: ${version ?? '<missing>'}`)
  console.error(`[align] a pre-release needs no alignment — publishing one already sets \`next\`.`)
  process.exit(1)
}

const summary = []
const note = (l) => { console.log(`[align] ${l}`); summary.push(l) }

// npm reports write-path auth failures as 404, never 401 — deliberately, so
// status codes cannot probe which private packages exist. Establish identity
// first, or a later 404 is ambiguous between "bad token" and "no such package".
let whoami = ''
try {
  whoami = execFileSync('npm', ['whoami'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
  note(`npm user: \`${whoami}\``)
} catch {
  console.error('[align] ✗ `npm whoami` failed — the token is missing or invalid.')
  console.error('[align]   Every later failure would surface as a 404 and look like a missing package.')
  process.exit(1)
}

const pkgs = publishedPackages()
note(`aligning \`next\` → \`${version}\` for ${pkgs.length} derived packages${dryRun ? ' (dry run)' : ''}`)

for (const pkg of pkgs) {
  let tags
  try {
    tags = JSON.parse(execFileSync('npm', ['view', pkg, 'dist-tags', '--json'],
      { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }))
  } catch {
    fail(`\`${pkg}\` — cannot read dist-tags`)
    continue
  }

  // BEFORE-STATE ASSERTION. Blindly running `dist-tag add <pkg>@<v> next` is
  // correct when the stable really published and catastrophic when --version is
  // wrong. `latest` must ALREADY be the target: the publish sets it, so if it
  // is not there, this is running against the wrong version or too early.
  const decision = decideAction(tags, version)
  if (decision.action === 'refuse') { fail(`\`${pkg}\` — refusing: ${decision.reason}`); continue }
  if (decision.action === 'skip') { note(`- \`${pkg}\` — ${decision.reason}`); continue }
  if (dryRun) { note(`- \`${pkg}\` — would move \`next\`: ${decision.reason}`); continue }

  try {
    execFileSync('npm', ['dist-tag', 'add', `${pkg}@${version}`, 'next'], { stdio: 'pipe' })
  } catch (err) {
    fail(`\`${pkg}\` — dist-tag add failed: ${(err?.stderr?.toString() ?? err?.message ?? '').split('\n')[0]}`)
    continue
  }

  // A zero exit is not evidence the tag moved. Ask the registry.
  try {
    const after = execFileSync('npm', ['view', pkg, 'dist-tags.next'],
      { encoding: 'utf8', stdio: ['ignore','pipe','ignore'] }).trim()
    if (after !== version) fail(`\`${pkg}\` — command succeeded but registry still reports \`next\`=${after}`)
    else note(`- \`${pkg}\` — \`next\`: ${tags.next} → ${version} ✓ verified`)
  } catch {
    fail(`\`${pkg}\` — cannot verify \`next\` after the write`)
  }
}

if (process.env['GITHUB_STEP_SUMMARY']) {
  const head = process.exitCode ? '### ⚠️ dist-tag alignment FAILED' : '### dist-tag alignment'
  appendFileSync(process.env['GITHUB_STEP_SUMMARY'], `${head}\n\n${summary.join('\n')}\n\n`)
}
if (process.exitCode) {
  console.error('[align] one or more packages were NOT aligned — `@next` is behind `@latest` for those.')
  console.error(`[align] recover with: npm dist-tag add <pkg>@${version} next`)
}
}
