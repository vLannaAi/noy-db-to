import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Importing must not read the registry or write a tag — the execute half is
// behind an isMain guard. Only the derivation is testable, and that is the
// half worth testing: it decides which packages a post-publish job touches.
import { publishedPackages } from '../align-dist-tags.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

describe('align-dist-tags: the package list is DERIVED, not transcribed', () => {
  // The scar this guards: the docs-bridge WIRING table was a hardcoded list,
  // to-browser-fs debuted as the 18th store and was never added, and the bridge
  // threw on TWO releases while both runs reported success. A dist-tag job with
  // a hardcoded list fails the same way — except after an irreversible publish.
  it('picks up a NEW store directory without any list being edited', () => {
    // This is the property, and it is why the first draft of this test was
    // worthless: comparing publishedPackages() against a reimplementation of
    // publishedPackages() is a tautology that passes no matter what. Create a
    // real directory and assert the result GREW.
    const before = publishedPackages()
    const dir = join(ROOT, 'to-zz-derivation-probe')
    try {
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@noy-db/to-zz-derivation-probe', version: '0.0.0' }))
      const after = publishedPackages()
      expect(after).toContain('@noy-db/to-zz-derivation-probe')
      expect(after.length).toBe(before.length + 1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    expect(publishedPackages()).toEqual(before)
  })

  it('returns a FLAT list, not floor groups', () => {
    // check-peer-floor's planGroups() lives next door and returns 2 groups for
    // this repo's two distinct peer floors. Every package gets the same stable
    // version on both tags, so grouping by floor would tag in two passes for no
    // reason — and is the obvious wrong thing to copy from the adjacent module.
    const p = publishedPackages()
    expect(Array.isArray(p)).toBe(true)
    expect(p.every(n => typeof n === 'string' && n.startsWith('@noy-db/to-'))).toBe(true)
    expect(new Set(p).size).toBe(p.length)
  })

  it('excludes private packages', () => {
    expect(publishedPackages().length).toBe(
      readdirSync(ROOT)
        .filter(d => d.startsWith('to-') && existsSync(join(ROOT, d, 'package.json')))
        .filter(d => JSON.parse(readFileSync(join(ROOT, d, 'package.json'), 'utf8')).private !== true)
        .length,
    )
  })
})
