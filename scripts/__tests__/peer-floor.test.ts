import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Importing the guard must not install, build or print anything — the script
// body is behind an `isMain` check. Only the pure "plan" half is testable; the
// "execute" half (install + build + typecheck) is what the CI job proves. A
// fixture that faked a floor failure would only test the fixture.
import { floorOf, pinnedRootText, planGroups } from '../check-peer-floor.mjs'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

describe('floorOf — the two ways semver.minVersion fails', () => {
  // THE BUG (found independently in klum-db, doi-db and here): minVersion
  // THROWS on a malformed range and RETURNS NULL on a well-formed but
  // unsatisfiable one. The original `minVersion(range)?.version` handled only
  // the null, so a malformed range killed the script with a raw stack trace
  // naming neither the package nor the range — and the friendly error branch
  // written for exactly that case was unreachable.
  it('returns null for a MALFORMED range instead of throwing', () => {
    expect(() => floorOf('not-a-range')).not.toThrow()
    expect(floorOf('not-a-range')).toBeNull()
  })

  it('returns null for a well-formed but UNSATISFIABLE range', () => {
    expect(floorOf('>1.0.0 <1.0.0')).toBeNull()
  })

  // An UNBOUNDED range is the third failure and the nastiest: semver floors
  // '', '   ', '*', 'x' and 'X' at 0.0.0, which neither throws nor returns
  // null. No @noy-db package has ever published 0.0.0, so the run plans a
  // phantom group and dies minutes later at install with "no matching version"
  // — blaming the registry instead of the manifest. This guard groups by
  // DISTINCT floor, so the failure is also attributed to a group rather than
  // to the package that caused it.
  it.each(['', '   ', '*', 'x', 'X'])('rejects the unbounded range %j rather than flooring it at 0.0.0', (range) => {
    expect(floorOf(range)).toBeNull()
  })

  // THE PROPERTY, not the named cases. Asserting only `.not.toThrow()` over
  // this table is what let the 0.0.0 bug through in the first place: '' does
  // not throw, it silently answers 0.0.0. A floor is only useful if it is a
  // version that could actually exist, so assert that — the named rows above
  // are regressions, this row is what finds the ones nobody has named yet.
  // Note '0.0.0' is deliberately NOT in this table: it is a well-formed BOUNDED
  // range whose floor genuinely is 0.0.0, so it belongs with the positive cases
  // below. The defect is reaching 0.0.0 from an UNBOUNDED range, not the value.
  it.each([
    '', ' ', '   ', '*', 'x', 'X', 'latest', 'next', '^^1.0.0', 'v', '>=', '~',
    '1.2.3.4', 'not-a-range', '>1.0.0 <1.0.0', '||', '^', undefined, null, 42, {},
  ])('floorOf(%j) is null or a real version — never 0.0.0, never a throw', (range) => {
    let out: unknown
    expect(() => { out = floorOf(range) }, `${JSON.stringify(range)} threw`).not.toThrow()
    if (out === null) return
    expect(typeof out, `${JSON.stringify(range)} -> ${JSON.stringify(out)}`).toBe('string')
    expect(out, 'no unbounded/invalid range may yield a floor of 0.0.0').not.toBe('0.0.0')
  })

  it('still floors an EXPLICIT 0.0.0 range at 0.0.0 — that one is honest', () => {
    // Rejecting the value rather than the unboundedness would be the wrong fix:
    // a package really pinned to 0.0.0 should fail at install naming itself,
    // which is the correct, legible outcome.
    expect(floorOf('0.0.0')).toBe('0.0.0')
  })
})

describe('floorOf — pre-release floors', () => {
  // The single likeliest silent regression in this script. Every range in this
  // repo is a pre-release range. Flooring `^0.6.0-pre.0` at `0.6.0` would test
  // a HIGHER version than the range admits, so a range that is false for
  // pre-releases would pass. The two values look alike at a glance.
  it('floors ^0.6.0-pre.0 at 0.6.0-pre.0, NOT 0.6.0', () => {
    expect(floorOf('^0.6.0-pre.0')).toBe('0.6.0-pre.0')
    expect(floorOf('^0.6.0-pre.0')).not.toBe('0.6.0')
  })

  it('floors the to-drive / to-icloud range at its real minimum', () => {
    // ^0.6.0-pre.11 is a genuine higher floor (StoreLocator.register() only
    // became generic there, #84) — not drift, and not to be "simplified".
    expect(floorOf('^0.6.0-pre.11')).toBe('0.6.0-pre.11')
  })

  it('takes the LOWEST branch of an || chain', () => {
    expect(floorOf('^0.5.0 || ^0.6.0-pre.0')).toBe('0.5.0')
  })
})

describe('floorOf — against the ranges actually declared in this repo', () => {
  const declared = readdirSync(ROOT)
    .filter((d) => d.startsWith('to-') && existsSync(join(ROOT, d, 'package.json')))
    .map((d) => JSON.parse(readFileSync(join(ROOT, d, 'package.json'), 'utf8')))
    .map((pj) => ({ name: pj.name as string, range: pj.peerDependencies?.['@noy-db/hub'] as string | undefined }))

  it('every store declares a hub peer range', () => {
    expect(declared.filter((p) => !p.range)).toEqual([])
  })

  it('every declared range yields a floor', () => {
    for (const p of declared) expect(floorOf(p.range!), `${p.name} declares ${p.range}`).not.toBeNull()
  })

  it('the plan still resolves to the two known distinct floors', () => {
    // Two floors is the current truth (#84): 16 stores at ^0.6.0-pre.0 and
    // to-drive / to-icloud at ^0.6.0-pre.11. If this changes, the change should
    // be deliberate — each distinct floor costs one full install in CI.
    expect([...planGroups().keys()].sort()).toEqual(['0.6.0-pre.0', '0.6.0-pre.11'])
  })
})

describe('pinnedRootText — the root package.json must survive a FAILING run', () => {
  // The script mutates the root package.json to inject a pnpm override and
  // restores it in `finally`. A restore regression corrupts the repo the gate
  // just checked, on the failure path, where nobody reads the diff.
  const original = readFileSync(join(ROOT, 'package.json'), 'utf8')

  it('pins the hub override without disturbing anything else', () => {
    const pinned = JSON.parse(pinnedRootText(original, '0.6.0-pre.0'))
    expect(pinned.pnpm.overrides['@noy-db/hub']).toBe('0.6.0-pre.0')
    const before = JSON.parse(original)
    for (const k of ['name', 'version', 'scripts', 'devDependencies']) {
      expect(pinned[k], k).toEqual(before[k])
    }
  })

  it('leaves the ORIGINAL text untouched, so restoring is byte-for-byte', () => {
    pinnedRootText(original, '0.6.0-pre.0')
    pinnedRootText(original, '0.6.0-pre.11')
    // The script restores by writing back the string it read before any
    // mutation — not by re-serialising — so this is the property that matters.
    expect(readFileSync(join(ROOT, 'package.json'), 'utf8')).toBe(original)
  })

  it('is repeatable — pinning a second floor does not stack overrides', () => {
    const once = pinnedRootText(original, '0.6.0-pre.0')
    const twice = pinnedRootText(original, '0.6.0-pre.11')
    expect(JSON.parse(once).pnpm.overrides['@noy-db/hub']).toBe('0.6.0-pre.0')
    expect(JSON.parse(twice).pnpm.overrides['@noy-db/hub']).toBe('0.6.0-pre.11')
  })
})
