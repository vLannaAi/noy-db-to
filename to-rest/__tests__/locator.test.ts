import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerRestStore, restStoreDescriptor } from '../src/index.js'
import { restHarness } from './_harness.js'

// noy-db-to#58 — `cloud` class. to-rest's options violate the credentialless
// rule twice (`fetch` is a function, `headers` carries the bearer token), so
// they are partitioned: transport into `binding`, auth onto the broker.

describe('to-rest — store-locator descriptor (#58)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerRestStore(locator)
    const descriptor = restStoreDescriptor({ baseUrl: 'https://vault.example.com' })
    const store = await locator.resolve(descriptor, {
      binding: { fetch: restHarness().fetch },
      credentials: async () => ({ kind: 'token', token: 'test-key' }),
    })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = restStoreDescriptor({ baseUrl: 'https://vault.example.com' }, { timeoutMs: 5000 })
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'rest',
      class: 'cloud',
      address: { baseUrl: 'https://vault.example.com' },
      options: { timeoutMs: 5000 },
    })
  })

  it('carries non-auth headers through the binding slot', async () => {
    const locator = createStoreLocator()
    registerRestStore(locator)
    const store = await locator.resolve(restStoreDescriptor({ baseUrl: 'https://vault.example.com' }), {
      binding: { fetch: restHarness().fetch, headers: { 'x-tenant': 'acme' } },
      credentials: async () => ({ kind: 'token', token: 'test-key' }),
    })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(restStoreDescriptor({ baseUrl: 'https://x' }))).toThrow()
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-rest (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerRestStore(locator)
  return locator.resolve(restStoreDescriptor({ baseUrl: 'https://vault.example.com' }), {
    binding: { fetch: restHarness().fetch },
    credentials: async () => ({ kind: 'token', token: 'test-key' }),
  })
})
