import { describe, expect, it, beforeEach } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerBrowserLocalStore, browserLocalStoreDescriptor } from '../src/index.js'

// noy-db-to#58 — the `browser`-class citizen: no binding, no credentials.

describe('to-browser-local — store-locator descriptor (#58)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerBrowserLocalStore(locator)
    const store = await locator.resolve(browserLocalStoreDescriptor({ prefix: 'lt' }))
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = browserLocalStoreDescriptor({ prefix: 'p' }, { obfuscate: true })
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'browser-local',
      class: 'browser',
      address: { prefix: 'p' },
      options: { obfuscate: true },
    })
  })

  it('omits the options key entirely when no options are given', () => {
    expect(browserLocalStoreDescriptor({ prefix: 'p' })).toEqual({
      kind: 'browser-local',
      class: 'browser',
      address: { prefix: 'p' },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(browserLocalStoreDescriptor({ prefix: 'p' }))).toThrow()
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests(
  'to-browser-local (descriptor-resolved via store locator)',
  async () => {
    localStorage.clear()
    const locator = createStoreLocator()
    registerBrowserLocalStore(locator)
    return locator.resolve(browserLocalStoreDescriptor({ prefix: `desc-${Date.now()}` }))
  },
  async () => {
    localStorage.clear()
  },
)
