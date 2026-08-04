import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerR2Store, r2StoreDescriptor } from '../src/index.js'
import { fakeS3 } from '../../to-aws-s3/__tests__/_fake-s3.js'

// noy-db-to#58 — `cloud` class. R2 keys are S3-compatible, so credentials
// ride the broker seam as `kind: 'aws'`; the descriptor never carries them.

describe('to-cloudflare-r2 — store-locator descriptor (#58)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerR2Store(locator)
    const descriptor = r2StoreDescriptor({ bucket: 'locator', accountId: 'acc' })
    const store = await locator.resolve(descriptor, { binding: { client: fakeS3().client } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = r2StoreDescriptor(
      { bucket: 'b', accountId: 'acc', prefix: 'p', endpoint: 'https://r2.example.com' },
      { clockUncertaintyMs: 1000 },
    )
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'cloudflare-r2',
      class: 'cloud',
      address: { bucket: 'b', accountId: 'acc', prefix: 'p', endpoint: 'https://r2.example.com' },
      options: { clockUncertaintyMs: 1000 },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(r2StoreDescriptor({ bucket: 'b', accountId: 'acc' }))).toThrow()
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-cloudflare-r2 (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerR2Store(locator)
  return locator.resolve(r2StoreDescriptor({ bucket: 'conformance', accountId: 'acc' }), {
    binding: { client: fakeS3().client },
  })
})
