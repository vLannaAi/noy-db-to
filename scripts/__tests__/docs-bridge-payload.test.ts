import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildPayload, hasRealDelta, isFirstPublishFromError } from '../docs-bridge/build-payload.mjs'

let root: string
const caps = {
  'to-alpha': { factory: 'toAlpha', shape: 'record', capabilities: { casAtomic: true, txAtomic: true }, optionDependent: false },
  'to-beta':  { factory: 'toBeta',  shape: 'record', capabilities: { casAtomic: false }, optionDependent: false },
  // txAtomic vocabulary edges (#39): option-dependent record store → 'conditional'; vault store → null.
  // Per-bit marker (vLannaAi/noy-db#930): conditionalBits names the varying bits.
  'to-gamma-cond':  { factory: 'toGammaCond',  shape: 'record', capabilities: { casAtomic: true, txAtomic: true }, optionDependent: true, conditionalBits: ['txAtomic'] },
  'to-delta-vault': { factory: 'toDeltaVault', shape: 'vault',  capabilities: null, optionDependent: false },
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'bridge-fixture-'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'noy-db-to', version: '0.9.0-pre.1', private: true }))
  for (const dir of ['to-alpha', 'to-beta', 'to-gamma-cond', 'to-delta-vault']) {
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
    expect(p.packages).toHaveLength(4)

    const alpha = p.packages.find((x: { dir: string }) => x.dir === 'to-alpha')!
    expect(alpha.name).toBe('@noy-db/to-alpha')
    expect(alpha.factory).toBe('toAlpha')
    expect(alpha.capabilities).toEqual({ casAtomic: true, txAtomic: true })
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

  it('emits per-package txAtomic in the scanner vocabulary (#39): literal, absent→false, conditional, vault→null', () => {
    const p = buildPayload({
      rootDir: root, caps, tag: 'v0.9.0-pre.1', channel: 'next',
      runUrl: 'u', isFirstPublish: () => false,
    })
    const byDir = Object.fromEntries(p.packages.map((x: { dir: string; txAtomic: unknown }) => [x.dir, x.txAtomic]))
    expect(byDir['to-alpha']).toBe(true)                 // declared literal
    expect(byDir['to-beta']).toBe(false)                 // record store, no txAtomic key
    expect(byDir['to-gamma-cond']).toBe('conditional')   // txAtomic listed in conditionalBits
    expect(byDir['to-delta-vault']).toBeNull()           // vault (pod) store — n/a
  })

  it('emits per-bit conditionalBits (vLannaAi/noy-db#930): listed for the option-dependent store, omitted everywhere else', () => {
    const p = buildPayload({
      rootDir: root, caps, tag: 'v0.9.0-pre.1', channel: 'next',
      runUrl: 'u', isFirstPublish: () => false,
    })
    const cond = p.packages.find((x: { dir: string }) => x.dir === 'to-gamma-cond')!
    expect(cond.conditionalBits).toEqual(['txAtomic'])
    expect(cond.optionDependent).toBe(true)              // store-level flag stays (back-compat)
    expect(cond.capabilities).toEqual({ casAtomic: true, txAtomic: true }) // recorded default-config value untouched
    for (const dir of ['to-alpha', 'to-beta', 'to-delta-vault']) {
      const entry = p.packages.find((x: { dir: string }) => x.dir === dir)! as object
      expect('conditionalBits' in entry, dir).toBe(false) // omitted, never an empty array
    }
  })

  it('throws when a store directory has no caps entry (wiring drift)', () => {
    const gammaRoot = mkdtempSync(join(tmpdir(), 'bridge-fixture-gamma-'))
    writeFileSync(join(gammaRoot, 'package.json'), JSON.stringify({ name: 'noy-db-to', version: '0.9.0-pre.1', private: true }))
    mkdirSync(join(gammaRoot, 'to-gamma'))
    writeFileSync(join(gammaRoot, 'to-gamma', 'package.json'), JSON.stringify({
      name: '@noy-db/to-gamma', version: '0.9.0-pre.1', peerDependencies: { '@noy-db/hub': '^0.4.0' },
    }))
    const gammaCaps = { 'to-gamma-unrelated': { factory: 'toGammaUnrelated', shape: 'record', capabilities: {}, optionDependent: false } }
    expect(() => buildPayload({
      rootDir: gammaRoot, caps: gammaCaps, tag: 't', channel: 'next', runUrl: 'u', isFirstPublish: () => false,
    })).toThrow(/to-gamma.*capability dump/)
  })

  it('ignores a stray to-*.md file at root instead of crashing', () => {
    writeFileSync(join(root, 'to-notes.md'), '# not a store\n')
    const p = buildPayload({
      rootDir: root, caps, tag: 'v0.9.0-pre.1', channel: 'next',
      runUrl: 'u', isFirstPublish: () => false,
    })
    expect(p.packages.map((x: { dir: string }) => x.dir)).toEqual(['to-alpha', 'to-beta', 'to-delta-vault', 'to-gamma-cond'])
  })
})

describe('hasRealDelta', () => {
  const pkg = (over: Partial<{ changeType: string; changelog: string | null }>) =>
    ({ name: '@noy-db/to-x', dir: 'to-x', version: '0.9.0', changeType: 'version-only', changelog: null, ...over })

  it('is false when every package is version-only with no changelog', () => {
    expect(hasRealDelta({ packages: [pkg({}), pkg({})] })).toBe(false)
  })

  it('is true when a package is added', () => {
    expect(hasRealDelta({ packages: [pkg({}), pkg({ changeType: 'added' })] })).toBe(true)
  })

  it('is true when a package is updated', () => {
    expect(hasRealDelta({ packages: [pkg({ changeType: 'updated', changelog: '- fixed x' })] })).toBe(true)
  })

  it('is true when a version-only package carries a non-empty changelog', () => {
    expect(hasRealDelta({ packages: [pkg({ changeType: 'version-only', changelog: '- noted anyway' })] })).toBe(true)
  })
})

describe('isFirstPublishFromError', () => {
  it('returns true when the npm error output indicates E404', () => {
    expect(isFirstPublishFromError({ stderr: 'npm error code E404\nnpm error 404 Not Found', stdout: '' })).toBe(true)
    expect(isFirstPublishFromError({ stderr: '', stdout: 'E404' })).toBe(true)
  })

  it('returns false for a non-E404 error, so npmIsFirstPublish rethrows instead of mislabeling', () => {
    expect(isFirstPublishFromError({ stderr: 'network timeout', stdout: '' })).toBe(false)
    expect(isFirstPublishFromError({ stderr: 'npm error code E401 Unauthorized', stdout: '' })).toBe(false)
    expect(isFirstPublishFromError(new Error('boom'))).toBe(false)
  })
})
