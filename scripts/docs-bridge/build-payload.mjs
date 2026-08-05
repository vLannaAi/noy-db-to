/**
 * Assemble docs-bridge.json (spec: docs/superpowers/specs/2026-07-30-docs-bridge-design.md).
 * Pure given its inputs; the CLI at the bottom wires the real fs/npm.
 *
 * changeType rule (ordered): "added" when isFirstPublish(name) — the package
 * has no published version before this release; else "updated" when the
 * CHANGELOG has a section for this version; else "version-only".
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { extractSection } from './changelog.mjs'

export function buildPayload({ rootDir, caps, tag, channel, runUrl, isFirstPublish }) {
  const rootPkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'))
  const dirs = readdirSync(rootDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('to-'))
    .map(d => d.name)
    .sort()
  let hubPeerRange = null

  const packages = dirs.map(dir => {
    const pkg = JSON.parse(readFileSync(join(rootDir, dir, 'package.json'), 'utf8'))
    const cap = caps[dir]
    if (!cap) throw new Error(`${dir}: no entry in the capability dump — add it to the WIRING table in scripts/__tests__/docs-bridge-capabilities.test.ts`)
    hubPeerRange ??= pkg.peerDependencies?.['@noy-db/hub'] ?? null

    const clPath = join(rootDir, dir, 'CHANGELOG.md')
    const changelog = existsSync(clPath) ? extractSection(readFileSync(clPath, 'utf8'), pkg.version) : null
    const changeType = isFirstPublish(pkg.name) ? 'added' : changelog !== null ? 'updated' : 'version-only'

    // vLannaAi/noy-db#930 — option-dependence is recorded PER BIT: the wiring
    // table's `conditionalBits` names the capability bits whose value depends
    // on the injected client/inner store (today: to-turso's txAtomic); the
    // recorded boolean in `capabilities` stays the default-configuration
    // value. The store-level `optionDependent` flag stays for backward
    // compatibility. `conditionalBits` is emitted only when non-empty.
    const conditionalBits = cap.conditionalBits?.length ? cap.conditionalBits : null

    // #39 — explicit per-store txAtomic for noy-db-docs' bridge divergence
    // check, in the scanner's vocabulary (registry/scan-to-capabilities.mjs):
    // true/false = literal declaration (absent key on a record store = false),
    // 'conditional' = the declaration varies with construction options
    // (txAtomic listed in `conditionalBits`), null = vault (pod) stores,
    // where NoydbStore capabilities don't apply.
    const txAtomic = cap.shape === 'record'
      ? (conditionalBits?.includes('txAtomic') ? 'conditional' : (cap.capabilities?.txAtomic ?? false))
      : null

    return {
      name: pkg.name, dir, version: pkg.version, description: pkg.description ?? null,
      factory: cap.factory, shape: cap.shape, capabilities: cap.capabilities, txAtomic,
      ...(conditionalBits ? { conditionalBits } : {}),
      optionDependent: cap.optionDependent, changeType, changelog,
    }
  })

  return {
    bridge: 1, repo: 'vLannaAi/noy-db-to',
    version: rootPkg.version, tag, channel, runUrl, hubPeerRange, packages,
  }
}

/**
 * True when the payload shows real work: some package was `added`/`updated`,
 * or carries a non-empty changelog body. An all-`version-only` payload with
 * no changelog text anywhere returns false — the docs-bridge job's signal
 * that a doc-sync issue is not worth opening (design:
 * noy-db-docs/docs/superpowers/specs/2026-08-05-family-channel-policy-design.md §3).
 */
export function hasRealDelta(payload) {
  return payload.packages.some(pkg =>
    pkg.changeType === 'added' || pkg.changeType === 'updated' || Boolean(pkg.changelog),
  )
}

/**
 * True when a failed `npm view` call means the package has never been published
 * (npm's E404). Any other failure (network blip, registry outage, auth error, …)
 * is NOT first-publish — the caller should rethrow rather than silently guessing.
 */
export function isFirstPublishFromError(err) {
  const text = `${err?.stderr ?? ''}${err?.stdout ?? ''}`.toString()
  return text.includes('E404')
}

/** True when npm knows no version of this package other than the current one. */
export function npmIsFirstPublish(name) {
  try {
    const out = execFileSync('npm', ['view', name, 'versions', '--json'], { stdio: 'pipe' }).toString()
    const versions = JSON.parse(out)
    const list = Array.isArray(versions) ? versions : [versions]
    return list.length <= 1
  } catch (err) {
    if (isFirstPublishFromError(err)) return true // not on the registry at all
    throw err // transient/other npm failure — fail visibly, don't mislabel
  }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const get = flag => { const i = args.indexOf(flag); return i === -1 ? null : args[i + 1] }
  const capsFile = get('--caps'); const tag = get('--tag'); const channel = get('--channel'); const runUrl = get('--run-url')
  if (!capsFile || !tag || !channel || !runUrl) {
    console.error('usage: build-payload.mjs --caps <file> --tag <git-tag> --channel <dist-tag> --run-url <url>')
    process.exit(1)
  }
  const caps = JSON.parse(readFileSync(capsFile, 'utf8'))
  const payload = buildPayload({ rootDir: process.cwd(), caps, tag, channel, runUrl, isFirstPublish: npmIsFirstPublish })
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n')
}
