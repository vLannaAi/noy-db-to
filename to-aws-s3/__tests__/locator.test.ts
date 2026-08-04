import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerS3Store, s3StoreDescriptor } from '../src/index.js'
import { fakeS3 } from './_fake-s3.js'

// noy-db-to#56 / noy-db#945 — the `cloud`-class reference: a
// credentialless, JSON-serializable descriptor reconstructs the store via
// the locator; credentials arrive via StoreCredentialSource at resolve
// time, and a pre-built client (test fake, custom middleware) rides the
// device-local `binding` slot.

describe('to-aws-s3 — store-locator descriptor (#56)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerS3Store(locator)
    const descriptor = s3StoreDescriptor({ bucket: 'b', region: 'eu-central-1', prefix: 'noydb' })
    const store = await locator.resolve(descriptor, { binding: { client: fakeS3().client } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = s3StoreDescriptor({ bucket: 'b', region: 'us-east-1' }, { clockUncertaintyMs: 2000 })
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'aws-s3',
      class: 'cloud',
      address: { bucket: 'b', region: 'us-east-1' },
      options: { clockUncertaintyMs: 2000 },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(s3StoreDescriptor({ bucket: 'b' }))).toThrow()
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-aws-s3 (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerS3Store(locator)
  return locator.resolve(s3StoreDescriptor({ bucket: 'b' }), { binding: { client: fakeS3().client } })
})
