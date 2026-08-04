import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerDynamoStore, dynamoStoreDescriptor } from '../src/index.js'
import { fakeDynamo } from './_fake-dynamo.js'

// noy-db-to#58 — `cloud` class; the document client rides the device-local
// `binding` slot, AWS credentials ride the broker seam. Neither touches the
// descriptor.

describe('to-aws-dynamo — store-locator descriptor (#58)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerDynamoStore(locator)
    const descriptor = dynamoStoreDescriptor({ table: 'locator' })
    const store = await locator.resolve(descriptor, { binding: { client: fakeDynamo().client } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = dynamoStoreDescriptor({ table: 't', region: 'eu-west-1', endpoint: 'http://localhost:8000' })
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'aws-dynamo',
      class: 'cloud',
      address: { table: 't', region: 'eu-west-1', endpoint: 'http://localhost:8000' },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(dynamoStoreDescriptor({ table: 't' }))).toThrow()
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-aws-dynamo (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerDynamoStore(locator)
  return locator.resolve(dynamoStoreDescriptor({ table: 'conformance' }), {
    binding: { client: fakeDynamo().client },
  })
})
