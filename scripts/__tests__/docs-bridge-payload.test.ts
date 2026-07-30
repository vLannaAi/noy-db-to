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
