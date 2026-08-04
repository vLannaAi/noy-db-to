import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerWebdavStore, webdavStoreDescriptor } from '../src/index.js'
import { fakeDav } from './_fake-dav.js'

// noy-db-to#56 / noy-db#945 — the `lan`-class model citizen: a
// credentialless, JSON-serializable descriptor reconstructs the store via
// the locator; transport overrides (a custom fetch wrapper) ride the
// device-local `binding` slot, never the descriptor.

describe('to-webdav — store-locator descriptor (#56)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerWebdavStore(locator)
    const descriptor = webdavStoreDescriptor({ baseUrl: 'https://dav.example.com', prefix: 'noydb' })
    const store = await locator.resolve(descriptor, { binding: { fetch: fakeDav().fetch } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = webdavStoreDescriptor(
      { baseUrl: 'https://dav.example.com', prefix: 'p' },
      { eagerMkcol: true },
    )
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'webdav',
      class: 'lan',
      address: { baseUrl: 'https://dav.example.com', prefix: 'p' },
      options: { eagerMkcol: true },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(webdavStoreDescriptor({ baseUrl: 'https://x' }))).toThrow()
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-webdav (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerWebdavStore(locator)
  return locator.resolve(webdavStoreDescriptor({ baseUrl: 'https://dav.example.com' }), {
    binding: { fetch: fakeDav().fetch },
  })
})
