# Docs Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every noy-db-to release emits a machine-readable `docs-bridge.json` (release asset + notify issue in noy-db-docs), and noy-db-docs' sync/registry tooling reads it — per spec `docs/superpowers/specs/2026-07-30-docs-bridge-design.md`.

**Architecture:** Producer (Tasks 1–5, repo `noy-db-to`, branch `feat/docs-bridge`): a changelog-section extractor, a capability dump that constructs all 16 stores with their conformance mocks, a payload builder, and a new post-publish `docs-bridge` job in `release.yml`. Consumer (Tasks 6–7, repo `noy-db-docs`): a `bridge.mjs` parser/classifier wired into `scripts/sync/sync.mjs` via `--bridge`, and a `--bridge` validation mode on `registry/scan-to-capabilities.mjs` (runtime-vs-static divergence gate).

**Tech Stack:** Node >= 22 ESM. noy-db-to: vitest (the root `scripts` vitest project), plain `.mjs` for non-TS tooling. noy-db-docs: `node --test` `.mjs` tests (existing `test:sync` pattern).

## Global Constraints

- **Never** add Claude/Anthropic attribution to commits, PRs, or CHANGELOGs. **Never** reference the private pilot client. **Never** publish without explicit user confirmation.
- No committed metadata/doc content in noy-db-to — the payload exists only as a release asset; `scripts/docs-bridge/` is private CI tooling (root package is `private: true`, ships nothing).
- Payload schema version field: `"bridge": 1`. Channel values come from the workflow's `Resolve npm dist-tag` step.
- noy-db-docs consumes noy-db-to **read-only** (release assets / sibling checkout); it publishes nothing.
- The two spec deviations already agreed during planning (dump runs under vitest, not `node --experimental-strip-types`; `changeType: added` decided by npm registry history, not git tree at previous tag) are folded into Task 4 Step 5's spec amendment.

---

## Part A — producer (repo: `noy-db-to`, branch `feat/docs-bridge`)

### Task 1: Changelog-section extractor

**Files:**
- Create: `scripts/docs-bridge/changelog.mjs`
- Test: `scripts/__tests__/docs-bridge-changelog.test.ts`

**Interfaces:**
- Produces: `extractSection(changelogText: string, version: string): string | null` — the verbatim body under `## <version>` (trimmed), `null` when no such heading. Used by Task 4.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/__tests__/docs-bridge-changelog.test.ts
import { describe, it, expect } from 'vitest'
import { extractSection } from '../docs-bridge/changelog.mjs'

const SAMPLE = `# @noy-db/to-webdav

## 0.3.0-pre.3

### Fix: something

- line one
- line two

## 0.3.0-pre.1

### Older

- old line
`

describe('extractSection', () => {
  it('extracts exactly the requested version section, trimmed', () => {
    expect(extractSection(SAMPLE, '0.3.0-pre.3')).toBe('### Fix: something\n\n- line one\n- line two')
  })

  it('extracts the last section (no trailing heading)', () => {
    expect(extractSection(SAMPLE, '0.3.0-pre.1')).toBe('### Older\n\n- old line')
  })

  it('returns null when the version has no section', () => {
    expect(extractSection(SAMPLE, '9.9.9')).toBeNull()
  })

  it('does not match versions that merely share a prefix', () => {
    expect(extractSection(SAMPLE, '0.3.0')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/docs-bridge-changelog.test.ts`
Expected: FAIL — `Cannot find module '../docs-bridge/changelog.mjs'`

- [ ] **Step 3: Write minimal implementation**

```js
// scripts/docs-bridge/changelog.mjs
/**
 * Extract the verbatim markdown body of a CHANGELOG's `## <version>` section.
 * Returns null when the version has no section (a version-only release for
 * that package). Matching is exact — `0.3.0` must not match `0.3.0-pre.3`.
 */
export function extractSection(changelogText, version) {
  const lines = changelogText.split('\n')
  const start = lines.findIndex(l => l.trim() === `## ${version}`)
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break }
  }
  return lines.slice(start + 1, end).join('\n').trim() || null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run scripts/__tests__/docs-bridge-changelog.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/docs-bridge/changelog.mjs scripts/__tests__/docs-bridge-changelog.test.ts
git commit -m "feat(docs-bridge): changelog-section extractor"
```

### Task 2: Extract the turso/d1 node:sqlite engines into importable modules

The capability dump (Task 3) must construct to-turso and to-cloudflare-d1, whose node:sqlite wrappers currently live inline in their conformance test files. Move them to `_engine.ts` modules (underscore prefix = not collected as tests), re-import from the conformance tests.

**Files:**
- Create: `to-turso/__tests__/_engine.ts` (move `libsqlOverNodeSqlite` from `to-turso/__tests__/conformance.test.ts`)
- Create: `to-cloudflare-d1/__tests__/_engine.ts` (move `d1OverNodeSqlite` from `to-cloudflare-d1/__tests__/conformance.test.ts`)
- Modify: both conformance tests to import from `./_engine.js`

**Interfaces:**
- Produces: `libsqlOverNodeSqlite(): LibsqlClient` and `d1OverNodeSqlite(): D1Database` — exact same bodies as today, now `export`ed. Task 3 imports them.

- [ ] **Step 1: Move each wrapper function verbatim** into its `_engine.ts`, prefixed `export`, carrying over the `node:sqlite` import and the type imports it needs (`LibsqlClient`, `LibsqlResultSet` from `../src/index.js`; `D1Database`, `D1PreparedStatement`, `D1Result` from `../src/index.js`). Replace the inline definitions in the two conformance tests with `import { libsqlOverNodeSqlite } from './_engine.js'` / `import { d1OverNodeSqlite } from './_engine.js'`, deleting the now-unused local imports.

- [ ] **Step 2: Run both suites to verify no regression**

Run: `pnpm vitest run to-turso to-cloudflare-d1`
Expected: PASS, same test counts as before the move (no skips, no failures)

- [ ] **Step 3: Commit**

```bash
git add to-turso/__tests__ to-cloudflare-d1/__tests__
git commit -m "refactor(test): extract node:sqlite engines to _engine.ts for reuse"
```

### Task 3: Capability dump (vitest-hosted, doubles as the 16-store drift alarm)

A vitest test in the `scripts` project that constructs all 16 stores exactly as their conformance tests do and asserts the dump shape; when `DOCS_BRIDGE_CAPS_OUT` is set it also writes the JSON. Pod stores (`to-drive`, `to-icloud`) have no `capabilities` field — they record `shape: "vault"`, `capabilities: null`.

**Files:**
- Test/Create: `scripts/__tests__/docs-bridge-capabilities.test.ts`

**Interfaces:**
- Consumes: Task 2's `_engine.ts` exports; each store's existing `__tests__/_mock.ts` / `_fake-*.ts`.
- Produces: caps JSON file (when `DOCS_BRIDGE_CAPS_OUT` set): `{ [dir: string]: { factory: string, shape: 'record' | 'vault', capabilities: object | null, optionDependent: boolean } }`. Task 4 reads this file.

- [ ] **Step 1: Write the dump test (it is both the test and the tool)**

```ts
// scripts/__tests__/docs-bridge-capabilities.test.ts
import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// Minimal localStorage shim — to-browser-local captures the global.
if (!('localStorage' in globalThis)) {
  const m = new Map<string, string>()
  ;(globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size },
  }
}

import { toAwsDynamo } from '../../to-aws-dynamo/src/index.js'
import { fakeDynamo } from '../../to-aws-dynamo/__tests__/_fake-dynamo.js'
import { toAwsS3 } from '../../to-aws-s3/src/index.js'
import { fakeS3 } from '../../to-aws-s3/__tests__/_fake-s3.js'
import { toBrowserLocal } from '../../to-browser-local/src/index.js'
import { toCloudflareD1 } from '../../to-cloudflare-d1/src/index.js'
import { d1OverNodeSqlite } from '../../to-cloudflare-d1/__tests__/_engine.js'
import { toCloudflareR2 } from '../../to-cloudflare-r2/src/index.js'
import { toDrive } from '../../to-drive/src/index.js'
import { mockDrive } from '../../to-drive/__tests__/_mock.js'
import { toIcloud } from '../../to-icloud/src/index.js'
import { mockFs } from '../../to-icloud/__tests__/_mock.js'
import { toMysql } from '../../to-mysql/src/index.js'
import { mockClient as mysqlMock } from '../../to-mysql/__tests__/_mock.js'
import { toNfs, type MountDetector } from '../../to-nfs/src/index.js'
import { toPostgres } from '../../to-postgres/src/index.js'
import { mockClient as pgMock } from '../../to-postgres/__tests__/_mock.js'
import { toSmb } from '../../to-smb/src/index.js'
import { mockSmb } from '../../to-smb/__tests__/_mock.js'
import { toSqlite } from '../../to-sqlite/src/index.js'
import { toSsh } from '../../to-ssh/src/index.js'
import { mockSftp } from '../../to-ssh/__tests__/_mock.js'
import { toSupabase } from '../../to-supabase/src/index.js'
import { toTurso } from '../../to-turso/src/index.js'
import { libsqlOverNodeSqlite } from '../../to-turso/__tests__/_engine.js'
import { toWebdav } from '../../to-webdav/src/index.js'
import { fakeDav } from '../../to-webdav/__tests__/_fake-dav.js'

const cleanDetector: MountDetector = async () => ({ exists: true, fstype: 'nfs4', options: ['rw', 'noac'] })

// The wiring table — one entry per published store. `optionDependent: true`
// marks capabilities that vary with construction options (recorded value =
// the conformance/representative configuration).
const WIRING: Record<string, { factory: string; shape: 'record' | 'vault'; optionDependent: boolean; make: () => unknown }> = {
  'to-aws-dynamo':    { factory: 'toAwsDynamo',    shape: 'record', optionDependent: false, make: () => toAwsDynamo({ table: 't', client: fakeDynamo().client }) },
  'to-aws-s3':        { factory: 'toAwsS3',        shape: 'record', optionDependent: false, make: () => toAwsS3({ bucket: 'b', client: fakeS3().client }) },
  'to-browser-local': { factory: 'toBrowserLocal', shape: 'record', optionDependent: false, make: () => toBrowserLocal({ prefix: 'docs-bridge-dump' }) },
  'to-cloudflare-d1': { factory: 'toCloudflareD1', shape: 'record', optionDependent: false, make: () => toCloudflareD1({ db: d1OverNodeSqlite() }) },
  'to-cloudflare-r2': { factory: 'toCloudflareR2', shape: 'record', optionDependent: false, make: () => toCloudflareR2({ bucket: 'b', client: fakeS3().client }) },
  'to-drive':         { factory: 'toDrive',        shape: 'vault',  optionDependent: false, make: () => toDrive({ drive: mockDrive() }) },
  'to-icloud':        { factory: 'toIcloud',       shape: 'vault',  optionDependent: false, make: () => toIcloud({ folder: '/docs-bridge-dump', fs: mockFs() }) },
  'to-mysql':         { factory: 'toMysql',        shape: 'record', optionDependent: false, make: () => toMysql({ client: mysqlMock() }) },
  'to-nfs':           { factory: 'toNfs',          shape: 'record', optionDependent: false, make: () => toNfs({ mountPath: mkdtempSync(join(tmpdir(), 'docs-bridge-nfs-')), mountDetector: cleanDetector }) },
  'to-postgres':      { factory: 'toPostgres',     shape: 'record', optionDependent: false, make: () => toPostgres({ client: pgMock() }) },
  'to-smb':           { factory: 'toSmb',          shape: 'record', optionDependent: false, make: () => toSmb({ smb: mockSmb() }) },
  'to-sqlite':        { factory: 'toSqlite',       shape: 'record', optionDependent: false, make: () => toSqlite({ db: new DatabaseSync(':memory:') }) },
  'to-ssh':           { factory: 'toSsh',          shape: 'record', optionDependent: false, make: () => toSsh({ sftp: mockSftp(), remotePath: 'noydb' }) },
  'to-supabase':      { factory: 'toSupabase',     shape: 'record', optionDependent: false, make: () => toSupabase({ client: pgMock() }) },
  'to-turso':         { factory: 'toTurso',        shape: 'record', optionDependent: true,  make: () => toTurso({ client: libsqlOverNodeSqlite() }) },
  'to-webdav':        { factory: 'toWebdav',       shape: 'record', optionDependent: false, make: () => toWebdav({ baseUrl: 'https://dump.example.com', fetch: fakeDav().fetch }) },
}

describe('docs-bridge capability dump', () => {
  it('constructs all 16 stores and dumps factory/shape/capabilities (writes DOCS_BRIDGE_CAPS_OUT when set)', () => {
    const dump: Record<string, { factory: string; shape: string; capabilities: object | null; optionDependent: boolean }> = {}
    for (const [dir, w] of Object.entries(WIRING)) {
      const store = w.make() as { capabilities?: object }
      const capabilities = w.shape === 'record' ? store.capabilities ?? null : null
      if (w.shape === 'record') {
        expect(capabilities, `${dir}: record store must expose capabilities`).toBeTruthy()
      }
      expect(w.factory).toMatch(/^to[A-Z]/)
      dump[dir] = { factory: w.factory, shape: w.shape, capabilities, optionDependent: w.optionDependent }
    }
    expect(Object.keys(dump)).toHaveLength(16)

    const out = process.env['DOCS_BRIDGE_CAPS_OUT']
    if (out) writeFileSync(out, JSON.stringify(dump, null, 2) + '\n')
  })
})
```

- [ ] **Step 2: Run it to verify it fails for the right reason**

Run: `pnpm vitest run scripts/__tests__/docs-bridge-capabilities.test.ts`
Expected: FAIL only if Task 2's `_engine.ts` files are missing or an import path is wrong; with Task 2 done this test should PASS on first run — that is acceptable here because the assertions (16 entries, non-null record capabilities) are the drift alarm this task exists to install, and each construction is already proven red/green by its conformance suite.

- [ ] **Step 3: Verify the file-writing path**

Run: `DOCS_BRIDGE_CAPS_OUT=/tmp/caps.json pnpm vitest run scripts/__tests__/docs-bridge-capabilities.test.ts && node -p "Object.keys(JSON.parse(require('fs').readFileSync('/tmp/caps.json'))).length"`
Expected: PASS, then `16`

- [ ] **Step 4: Commit**

```bash
git add scripts/__tests__/docs-bridge-capabilities.test.ts
git commit -m "feat(docs-bridge): runtime capability dump over the conformance mocks (16-store drift alarm)"
```

### Task 4: Payload builder

**Files:**
- Create: `scripts/docs-bridge/build-payload.mjs`
- Test: `scripts/__tests__/docs-bridge-payload.test.ts`
- Modify: `docs/superpowers/specs/2026-07-30-docs-bridge-design.md` (record the two mechanism deviations)

**Interfaces:**
- Consumes: `extractSection` (Task 1); the caps JSON file shape (Task 3).
- Produces: `buildPayload(opts): object` where `opts = { rootDir, caps, tag, channel, runUrl, isFirstPublish: (pkgName) => boolean }` returning the spec's schema (`bridge: 1`, `repo`, `version`, `tag`, `channel`, `runUrl`, `hubPeerRange`, `packages[]` each `{ name, dir, version, description, factory, shape, capabilities, optionDependent, changeType, changelog }`). CLI: `node scripts/docs-bridge/build-payload.mjs --caps <file> --tag <git-tag> --channel <dist-tag> --run-url <url>` printing JSON to stdout. Task 5's workflow and Task 6's fixtures rely on this exact schema.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/__tests__/docs-bridge-payload.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPayload } from '../docs-bridge/build-payload.mjs'

let root: string
const caps = {
  'to-alpha': { factory: 'toAlpha', shape: 'record', capabilities: { casAtomic: true }, optionDependent: false },
  'to-beta':  { factory: 'toBeta',  shape: 'record', capabilities: { casAtomic: false }, optionDependent: false },
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'bridge-fixture-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'noy-db-to', version: '0.9.0-pre.1', private: true }))
  for (const dir of ['to-alpha', 'to-beta']) {
    mkdirSync(join(root, dir))
    writeFileSync(join(root, dir, 'package.json'), JSON.stringify({
      name: `@noy-db/${dir}`, version: '0.9.0-pre.1', description: `${dir} store`,
      peerDependencies: { '@noy-db/hub': '^0.4.0' },
    }))
  }
  writeFileSync(join(root, 'to-alpha', 'CHANGELOG.md'), '# @noy-db/to-alpha\n\n## 0.9.0-pre.1\n\n### Fix: x\n\n- fixed x\n')
  writeFileSync(join(root, 'to-beta', 'CHANGELOG.md'), '# @noy-db/to-beta\n\n## 0.1.0\n\n- ancient\n')
})

describe('buildPayload', () => {
  it('assembles the schema with per-package changeType and verbatim changelog', () => {
    const p = buildPayload({
      rootDir: root, caps, tag: 'v0.9.0-pre.1', channel: 'next',
      runUrl: 'https://example.com/run/1',
      isFirstPublish: (name: string) => name === '@noy-db/to-beta',
    })
    expect(p.bridge).toBe(1)
    expect(p.repo).toBe('vLannaAi/noy-db-to')
    expect(p.version).toBe('0.9.0-pre.1')
    expect(p.tag).toBe('v0.9.0-pre.1')
    expect(p.channel).toBe('next')
    expect(p.hubPeerRange).toBe('^0.4.0')
    expect(p.packages).toHaveLength(2)

    const alpha = p.packages.find((x: { dir: string }) => x.dir === 'to-alpha')!
    expect(alpha.name).toBe('@noy-db/to-alpha')
    expect(alpha.factory).toBe('toAlpha')
    expect(alpha.capabilities).toEqual({ casAtomic: true })
    expect(alpha.changeType).toBe('updated')
    expect(alpha.changelog).toBe('### Fix: x\n\n- fixed x')

    const beta = p.packages.find((x: { dir: string }) => x.dir === 'to-beta')!
    expect(beta.changeType).toBe('added')          // first publish wins over changelog presence
    const betaNoFirst = buildPayload({
      rootDir: root, caps, tag: 'v0.9.0-pre.1', channel: 'next',
      runUrl: 'u', isFirstPublish: () => false,
    }).packages.find((x: { dir: string }) => x.dir === 'to-beta')!
    expect(betaNoFirst.changeType).toBe('version-only')  // no section for THIS version
    expect(betaNoFirst.changelog).toBeNull()
  })

  it('throws when a store directory has no caps entry (wiring drift)', () => {
    mkdirSync(join(root, 'to-gamma'))
    writeFileSync(join(root, 'to-gamma', 'package.json'), JSON.stringify({
      name: '@noy-db/to-gamma', version: '0.9.0-pre.1', peerDependencies: { '@noy-db/hub': '^0.4.0' },
    }))
    expect(() => buildPayload({
      rootDir: root, caps, tag: 't', channel: 'next', runUrl: 'u', isFirstPublish: () => false,
    })).toThrow(/to-gamma.*capability dump/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run scripts/__tests__/docs-bridge-payload.test.ts`
Expected: FAIL — `Cannot find module '../docs-bridge/build-payload.mjs'`

- [ ] **Step 3: Write the implementation**

```js
// scripts/docs-bridge/build-payload.mjs
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
  const dirs = readdirSync(rootDir).filter(d => d.startsWith('to-')).sort()
  let hubPeerRange = null

  const packages = dirs.map(dir => {
    const pkg = JSON.parse(readFileSync(join(rootDir, dir, 'package.json'), 'utf8'))
    const cap = caps[dir]
    if (!cap) throw new Error(`${dir}: no entry in the capability dump — add it to the WIRING table in scripts/__tests__/docs-bridge-capabilities.test.ts`)
    hubPeerRange ??= pkg.peerDependencies?.['@noy-db/hub'] ?? null

    const clPath = join(rootDir, dir, 'CHANGELOG.md')
    const changelog = existsSync(clPath) ? extractSection(readFileSync(clPath, 'utf8'), pkg.version) : null
    const changeType = isFirstPublish(pkg.name) ? 'added' : changelog !== null ? 'updated' : 'version-only'

    return {
      name: pkg.name, dir, version: pkg.version, description: pkg.description ?? null,
      factory: cap.factory, shape: cap.shape, capabilities: cap.capabilities,
      optionDependent: cap.optionDependent, changeType, changelog,
    }
  })

  return {
    bridge: 1, repo: 'vLannaAi/noy-db-to',
    version: rootPkg.version, tag, channel, runUrl, hubPeerRange, packages,
  }
}

/** True when npm knows no version of this package other than the current one. */
export function npmIsFirstPublish(name) {
  try {
    const out = execFileSync('npm', ['view', name, 'versions', '--json'], { stdio: 'pipe' }).toString()
    const versions = JSON.parse(out)
    const list = Array.isArray(versions) ? versions : [versions]
    return list.length <= 1
  } catch {
    return true // not on the registry at all
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
```

- [ ] **Step 4: Run tests to verify they pass** (and the full scripts project still passes)

Run: `pnpm vitest run scripts`
Expected: PASS (changelog + capabilities + payload tests, plus pre-existing scripts tests)

- [ ] **Step 5: Amend the spec's two mechanism paragraphs** in `docs/superpowers/specs/2026-07-30-docs-bridge-design.md`: (a) in the `dump-capabilities` paragraph, replace the `node --experimental-strip-types` sentence with "Runs as a vitest test in the root `scripts` project (`DOCS_BRIDGE_CAPS_OUT` env var triggers the file write) — vitest resolves the mocks' `.js → .ts` source imports, which plain Node type-stripping cannot; this also removes the `pnpm build` prerequisite and makes the dump double as the 16-store drift alarm." (b) replace the `changeType` `added` clause with "when the package has no npm-published version prior to this release (registry history — the release checkout has no git history at depth 1)". (c) In the consumer's matrix bullet, note that noy-db-docs already generates the matrix from `registry/scan-to-capabilities.mjs` (static scan of the sibling checkout), so the bridge integrates as a **runtime-vs-static divergence gate** on that scanner (`--bridge`) rather than the renderer consuming bridge rows directly — same "never silently prefer either" guarantee, existing pipeline preserved. Also add `shape: "record" | "vault"` to the schema example with a note that vault (pod) stores carry `capabilities: null`.

- [ ] **Step 6: Commit**

```bash
git add scripts/docs-bridge/build-payload.mjs scripts/__tests__/docs-bridge-payload.test.ts docs/superpowers/specs/2026-07-30-docs-bridge-design.md
git commit -m "feat(docs-bridge): payload builder + spec mechanism amendments"
```

### Task 5: `release.yml` — the `docs-bridge` job, PR, and producer wrap-up

**Files:**
- Modify: `.github/workflows/release.yml` (add `outputs` to the `publish` job; append a new `docs-bridge` job)

**Interfaces:**
- Consumes: Task 3's env-triggered dump; Task 4's CLI.
- Produces: on every release-event publish — release asset `docs-bridge.json` + issue `doc-sync needed: <tag> @<channel>` in `vLannaAi/noy-db-docs`.

- [ ] **Step 1: Add outputs to the publish job.** Directly under `publish:` → after `runs-on: ubuntu-latest`, add:

```yaml
    outputs:
      dist_tag: ${{ steps.dist_tag.outputs.tag }}
```

- [ ] **Step 2: Append the new job** at the end of `release.yml` (job-level `continue-on-error` so nothing here can fail a publish that already succeeded; asset upload uses the workflow's own token with `contents: write` scoped to THIS job only; the cross-repo issue uses `DOCS_SYNC_TOKEN`, same mechanism as noy-db's `Notify noy-db-docs` step):

```yaml
  # ── Docs bridge (spec: docs/superpowers/specs/2026-07-30-docs-bridge-design.md) ──
  #
  # Builds the machine-readable release payload (docs-bridge.json), attaches
  # it to the GitHub Release as an asset, and opens a `doc-sync needed` issue
  # in noy-db-docs — the same cross-repo pattern noy-db's release.yml uses.
  #
  # continue-on-error at the JOB level: a docs-side outage or missing
  # DOCS_SYNC_TOKEN must never fail a publish that already succeeded.
  # DOCS_SYNC_TOKEN is a fine-grained PAT with Issues:write on
  # vLannaAi/noy-db-docs (Settings → Secrets); without it the issue step
  # no-ops and doc-sync is triggered by hand.
  docs-bridge:
    name: Docs bridge payload + notify
    needs: publish
    if: github.event_name == 'release'
    runs-on: ubuntu-latest
    continue-on-error: true
    permissions:
      contents: write   # gh release upload (asset on THIS repo's release)
    steps:
      - uses: actions/checkout@v5
        with:
          ref: ${{ github.event.release.tag_name }}

      - uses: actions/setup-node@v5
        with:
          node-version: '22'
          package-manager-cache: false

      - name: Enable corepack (pnpm)
        run: corepack enable

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build payload
        run: |
          DOCS_BRIDGE_CAPS_OUT=/tmp/caps.json pnpm vitest run scripts/__tests__/docs-bridge-capabilities.test.ts
          node scripts/docs-bridge/build-payload.mjs \
            --caps /tmp/caps.json \
            --tag "${{ github.event.release.tag_name }}" \
            --channel "${{ needs.publish.outputs.dist_tag }}" \
            --run-url "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}" \
            > /tmp/docs-bridge.json
          node -e "const p=require('/tmp/docs-bridge.json'); if (p.bridge!==1||!p.packages.length) process.exit(1); console.log('payload ok:', p.packages.length, 'packages')"

      - name: Attach payload to the release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release upload "${{ github.event.release.tag_name }}" /tmp/docs-bridge.json --clobber

      - name: Open doc-sync issue in noy-db-docs
        env:
          GH_TOKEN: ${{ secrets.DOCS_SYNC_TOKEN }}
        run: |
          TAG="${{ github.event.release.tag_name }}"
          CHANNEL="${{ needs.publish.outputs.dist_tag }}"
          ASSET_URL="${{ github.server_url }}/${{ github.repository }}/releases/download/$TAG/docs-bridge.json"
          {
            echo "noy-db-to \`$TAG\` was just published to npm dist-tag \`$CHANNEL\`."
            echo ""
            echo "- Machine-readable payload: $ASSET_URL"
            echo "- Run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            echo ""
            echo "Per-store deltas:"
            node -e "
              const p = require('/tmp/docs-bridge.json');
              for (const s of p.packages) console.log('- ' + s.name + ' — ' + s.changeType);
            "
            echo ""
            echo "Run the doc-sync with the bridge: \`node scripts/sync/sync.mjs --partition adapters --bridge <downloaded docs-bridge.json>\` — see docs/doc-sync.md."
          } > /tmp/doc-sync-issue-body.md
          gh issue create -R vLannaAi/noy-db-docs \
            --title "doc-sync needed: noy-db-to $TAG @$CHANNEL" \
            --body-file /tmp/doc-sync-issue-body.md
```

- [ ] **Step 3: Validate the YAML parses**

Run: `ruby -ryaml -e 'YAML.load_file(".github/workflows/release.yml"); puts "yaml ok"'`
Expected: `yaml ok`

- [ ] **Step 4: Run the full local gates**

Run: `pnpm build && pnpm typecheck && pnpm test && pnpm lint && pnpm check:architecture`
Expected: all green (test count grows by the three new scripts tests)

- [ ] **Step 5: Grep, commit, push, open the PR**

```bash
git add .github/workflows/release.yml
git diff origin/main...HEAD | grep -inE "claude|anthropic|co-authored" ; echo "exit=$? (1 = clean)"
git commit -m "ci(release): docs-bridge job — payload asset + doc-sync issue to noy-db-docs"
git push -u origin feat/docs-bridge
gh pr create --repo vLannaAi/noy-db-to \
  --title "feat: docs bridge — machine-readable release payload for noy-db-docs" \
  --body "Producer half of docs/superpowers/specs/2026-07-30-docs-bridge-design.md: changelog extractor, runtime capability dump over the conformance mocks (16-store drift alarm), payload builder, and a post-publish docs-bridge job that attaches docs-bridge.json to the release and opens the doc-sync issue in noy-db-docs. Inert until DOCS_SYNC_TOKEN is provisioned; job-level continue-on-error so it can never fail a publish."
```

Expected: PR opens; CI green. **Reminder to the maintainer in the PR/summary:** provision `DOCS_SYNC_TOKEN` (fine-grained PAT, Issues:write on vLannaAi/noy-db-docs) in noy-db-to's Settings → Secrets.

---

## Part B — consumer (repo: `noy-db-docs` — `cd ../noy-db-docs`, branch `feat/docs-bridge-consumer`)

### Task 6: `scripts/sync/bridge.mjs` + `--bridge` in sync.mjs

**Files:**
- Create: `scripts/sync/bridge.mjs`
- Test: `scripts/sync/bridge.test.mjs` (node --test, like the sibling `*.test.mjs`)
- Modify: `scripts/sync/sync.mjs` (`parseArgs`, `printHumanPlan`, `--json` output)

**Interfaces:**
- Consumes: Task 4's payload schema.
- Produces: `parseBridge(json: object): object` (throws on `bridge !== 1`); `classifyBridge(payload): Array<{ dir, name, classification: 'ADD'|'UPDATE'|'VERSION-ONLY', changelog: string|null }>`; `fetchBridge(tag?: string): object` (gh release download wrapper). sync.mjs gains `--bridge <file>`.

- [ ] **Step 1: Write the failing test**

```js
// scripts/sync/bridge.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBridge, classifyBridge } from './bridge.mjs'

const payload = {
  bridge: 1, repo: 'vLannaAi/noy-db-to', version: '0.9.0-pre.1', tag: 'v0.9.0-pre.1',
  channel: 'next', runUrl: 'u', hubPeerRange: '^0.4.0',
  packages: [
    { name: '@noy-db/to-alpha', dir: 'to-alpha', version: '0.9.0-pre.1', description: 'a', factory: 'toAlpha', shape: 'record', capabilities: { casAtomic: true }, optionDependent: false, changeType: 'updated', changelog: '### Fix' },
    { name: '@noy-db/to-beta', dir: 'to-beta', version: '0.9.0-pre.1', description: 'b', factory: 'toBeta', shape: 'record', capabilities: { casAtomic: false }, optionDependent: false, changeType: 'added', changelog: null },
    { name: '@noy-db/to-gamma', dir: 'to-gamma', version: '0.9.0-pre.1', description: 'c', factory: 'toGamma', shape: 'vault', capabilities: null, optionDependent: false, changeType: 'version-only', changelog: null },
  ],
}

test('parseBridge accepts schema v1 and rejects others', () => {
  assert.equal(parseBridge(payload).version, '0.9.0-pre.1')
  assert.throws(() => parseBridge({ ...payload, bridge: 2 }), /unsupported bridge schema/)
  assert.throws(() => parseBridge({}), /unsupported bridge schema/)
})

test('classifyBridge maps changeType to runbook classifications with changelog attached', () => {
  const rows = classifyBridge(payload)
  assert.deepEqual(rows.map(r => [r.dir, r.classification]), [
    ['to-alpha', 'UPDATE'], ['to-beta', 'ADD'], ['to-gamma', 'VERSION-ONLY'],
  ])
  assert.equal(rows[0].changelog, '### Fix')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ../noy-db-docs && node --test scripts/sync/bridge.test.mjs`
Expected: FAIL — cannot find `./bridge.mjs`

- [ ] **Step 3: Implement**

```js
// scripts/sync/bridge.mjs
/**
 * noy-db-to release-bridge reader (producer spec:
 * noy-db-to/docs/superpowers/specs/2026-07-30-docs-bridge-design.md).
 * Parses docs-bridge.json (a release asset on vLannaAi/noy-db-to) and maps
 * per-store changeType to the runbook's classification vocabulary. This
 * pre-fills the adapters-partition plan; it makes no decisions — all
 * runbook gates stay with the human.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CLASSIFICATION = { added: 'ADD', updated: 'UPDATE', 'version-only': 'VERSION-ONLY' }

export function parseBridge(json) {
  if (!json || json.bridge !== 1 || !Array.isArray(json.packages)) {
    throw new Error(`unsupported bridge schema: expected { bridge: 1, packages: [...] }`)
  }
  return json
}

export function classifyBridge(payload) {
  return payload.packages.map(p => ({
    dir: p.dir,
    name: p.name,
    classification: CLASSIFICATION[p.changeType] ?? 'UPDATE',
    changelog: p.changelog ?? null,
  }))
}

/** Download docs-bridge.json from a noy-db-to release (default: newest). */
export function fetchBridge(tag) {
  const dir = mkdtempSync(join(tmpdir(), 'docs-bridge-'))
  const args = ['release', 'download', ...(tag ? [tag] : []), '-R', 'vLannaAi/noy-db-to', '-p', 'docs-bridge.json', '-D', dir]
  execFileSync('gh', args, { stdio: 'pipe' })
  return parseBridge(JSON.parse(readFileSync(join(dir, 'docs-bridge.json'), 'utf8')))
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test scripts/sync/bridge.test.mjs`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire `--bridge <file>` into sync.mjs.** In `parseArgs`, add to the `opts` literal `bridge: null,` and to the arg loop `else if (arg === '--bridge') opts.bridge = argv[++i]`. In `main()` after `const plan = classifyPlan(scope)`, insert:

```js
  if (opts.bridge) {
    const { parseBridge, classifyBridge } = await import('./bridge.mjs')
    const payload = parseBridge(JSON.parse(readFileSync(opts.bridge, 'utf8')))
    plan.bridge = {
      repo: payload.repo, version: payload.version, tag: payload.tag, channel: payload.channel,
      stores: classifyBridge(payload),
    }
  }
```

(`main()` becomes `async function main()` and the trailing call `await main()` — node ESM top-level await is fine.) In `printHumanPlan`, after the informational block, add:

```js
  if (plan.bridge) {
    console.log(`Bridge (noy-db-to ${plan.bridge.tag} @${plan.bridge.channel}) — per-store pre-classification:`)
    for (const s of plan.bridge.stores) {
      console.log(`  ${s.classification.padEnd(12)} ${s.name}${s.changelog ? ' — ' + s.changelog.split('\n')[0] : ''}`)
    }
    console.log()
  }
```

The `--json` path needs no change (`plan.bridge` rides along in the serialized plan).

- [ ] **Step 6: Run the full sync test suite + a live smoke**

Run: `pnpm test:sync` then `node scripts/sync/sync.mjs --partition adapters --offline --dist-tags <(echo '{}') 2>&1 | head -3`
Expected: tests PASS; sync still runs without `--bridge` (no regression). Then with a fixture: `node scripts/sync/sync.mjs --partition adapters --offline --dist-tags <(echo '{}') --bridge scripts/sync/fixture-bridge.json` — create the fixture inline from the test payload if a manual smoke is wanted (not committed).

- [ ] **Step 7: Commit**

```bash
git add scripts/sync/bridge.mjs scripts/sync/bridge.test.mjs scripts/sync/sync.mjs
git commit -m "feat(sync): read the noy-db-to docs-bridge payload (--bridge) and pre-classify adapter stores"
```

### Task 7: `scan-to-capabilities.mjs --bridge` — the runtime-vs-static divergence gate

The scanner's static read of the sibling checkout stays the generator; `--bridge <file>` additionally cross-checks the payload's **runtime-constructed** capabilities against the static scan and fails loudly on divergence (the spec's gate: never silently prefer either source).

**Files:**
- Modify: `registry/scan-to-capabilities.mjs`
- Test: `scripts/sync/bridge-divergence.test.mjs` (node --test; the registry dir has no test harness — the sync test dir is the established home for bridge logic tests, and the check function lives in `bridge.mjs` so it is importable from both)

**Interfaces:**
- Consumes: Task 6's `parseBridge`; the scanner's generated manifest shape (`registry/generated/to-capabilities.json`: `{ stores: { [dir]: { record, vault, casAtomic } }, _generated: {...} }` — confirm the exact key names by reading the generated file first and adapt the code below if they differ).
- Produces: `checkBridgeDivergence(bridgePayload, scannedStores): Array<{ dir, field, bridge, scanned }>` exported from `scripts/sync/bridge.mjs`; scanner flag `--bridge <file>` that exits 1 listing divergences.

- [ ] **Step 1: Read the generated manifest to confirm its shape**

Run: `head -30 registry/generated/to-capabilities.json`
Expected: per-store entries with a `casAtomic` (and shape booleans). If key names differ from `{ record, vault, casAtomic }`, substitute the real names in the following steps.

- [ ] **Step 2: Write the failing test** (in `scripts/sync/bridge-divergence.test.mjs`)

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { checkBridgeDivergence } from './bridge.mjs'

const payload = {
  bridge: 1, packages: [
    { dir: 'to-alpha', shape: 'record', capabilities: { casAtomic: true } },
    { dir: 'to-gamma', shape: 'vault', capabilities: null },
  ],
}

test('no divergence when runtime matches static', () => {
  const scanned = { 'to-alpha': { record: true, vault: false, casAtomic: true }, 'to-gamma': { record: false, vault: true, casAtomic: null } }
  assert.deepEqual(checkBridgeDivergence(payload, scanned), [])
})

test('reports a casAtomic mismatch', () => {
  const scanned = { 'to-alpha': { record: true, vault: false, casAtomic: false }, 'to-gamma': { record: false, vault: true, casAtomic: null } }
  const d = checkBridgeDivergence(payload, scanned)
  assert.equal(d.length, 1)
  assert.deepEqual(d[0], { dir: 'to-alpha', field: 'casAtomic', bridge: true, scanned: false })
})

test('reports a store present in only one source', () => {
  const d = checkBridgeDivergence(payload, { 'to-alpha': { record: true, vault: false, casAtomic: true } })
  assert.equal(d.length, 1)
  assert.equal(d[0].dir, 'to-gamma')
  assert.equal(d[0].field, 'presence')
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `node --test scripts/sync/bridge-divergence.test.mjs`
Expected: FAIL — `checkBridgeDivergence` is not exported

- [ ] **Step 4: Implement** — append to `scripts/sync/bridge.mjs`:

```js
/**
 * Runtime (bridge) vs static (scanner) capability cross-check. Returns a
 * list of divergences; empty = the two independent reads agree. Fields
 * compared: presence, and casAtomic for record-shaped stores (the scanner's
 * vault-only rows carry casAtomic: null, matching the bridge's
 * capabilities: null for pod stores).
 */
export function checkBridgeDivergence(payload, scannedStores) {
  const divergences = []
  for (const p of payload.packages) {
    const scanned = scannedStores[p.dir]
    if (!scanned) { divergences.push({ dir: p.dir, field: 'presence', bridge: true, scanned: false }); continue }
    const bridgeCas = p.shape === 'record' ? (p.capabilities?.casAtomic ?? null) : null
    if (bridgeCas !== (scanned.casAtomic ?? null)) {
      divergences.push({ dir: p.dir, field: 'casAtomic', bridge: bridgeCas, scanned: scanned.casAtomic ?? null })
    }
  }
  for (const dir of Object.keys(scannedStores)) {
    if (!payload.packages.some(p => p.dir === dir)) {
      divergences.push({ dir, field: 'presence', bridge: false, scanned: true })
    }
  }
  return divergences
}
```

Then in `registry/scan-to-capabilities.mjs`, add flag handling next to the existing `--check` parsing: when `--bridge <file>` is present, after the static scan completes, import `parseBridge`/`checkBridgeDivergence` from `../scripts/sync/bridge.mjs`, run the check against the scanned stores object, and: empty → `console.log('✓ bridge capabilities agree with the static scan (<tag>)')`; non-empty → print each divergence as `✗ <dir>.<field>: bridge=<v> static=<v>` and `process.exit(1)` with the message `bridge/static capability divergence — resolve which source is wrong before syncing (see doc-sync runbook gates)`.

- [ ] **Step 5: Run tests + an end-to-end smoke**

Run: `node --test scripts/sync/bridge-divergence.test.mjs && pnpm test:sync`
Expected: PASS. Smoke (needs a real published payload — available after the first post-Task-5 release): `gh release download -R vLannaAi/noy-db-to -p docs-bridge.json -D /tmp && node registry/scan-to-capabilities.mjs --bridge /tmp/docs-bridge.json` → agreement or a legitimate divergence report. If no release with an asset exists yet, smoke with a hand-built fixture instead and note that in the PR.

- [ ] **Step 6: Commit + PR (noy-db-docs)**

```bash
git add scripts/sync/bridge.mjs scripts/sync/bridge-divergence.test.mjs registry/scan-to-capabilities.mjs
git commit -m "feat(registry): --bridge divergence gate — runtime capabilities cross-check the static scan"
git push -u origin feat/docs-bridge-consumer
gh pr create --title "feat(sync): consume the noy-db-to docs-bridge payload" \
  --body "Consumer half of the docs-bridge contract (spec lives in noy-db-to: docs/superpowers/specs/2026-07-30-docs-bridge-design.md): bridge.mjs parser/classifier, --bridge on sync.mjs (per-store ADD/UPDATE/VERSION-ONLY pre-classification with changelog attached), and a runtime-vs-static capability divergence gate on scan-to-capabilities.mjs. All runbook gates unchanged."
```

---

## Rollout checklist (from the spec — after both PRs merge)

1. Maintainer provisions `DOCS_SYNC_TOKEN` in noy-db-to (fine-grained PAT, Issues:write on vLannaAi/noy-db-docs).
2. Next noy-db-to release exercises the loop: verify the asset on the release, the issue in noy-db-docs, `sync.mjs --partition adapters --bridge` output, and the `--bridge` divergence gate.
3. File the noy-db follow-up issue: emit the same payload shape for the 5 essential stores.
