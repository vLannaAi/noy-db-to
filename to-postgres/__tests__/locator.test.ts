import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerPostgresStore, postgresStoreDescriptor } from '../src/index.js'
import { mockClient } from './_mock.js'

// noy-db-to#58 — opaque-client tier: a credentialless, JSON-serializable
// descriptor reconstructs the store via the locator; the live connection
// (this store has no client library of its own) rides the device-local
// `binding.client` slot, never the descriptor.

describe('to-postgres — store-locator descriptor (#58)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerPostgresStore(locator)
    const descriptor = postgresStoreDescriptor({ database: 'app', schema: 'public', table: 'noydb_envelopes' })
    const store = await locator.resolve(descriptor, { binding: { client: mockClient() } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = postgresStoreDescriptor(
      { database: 'app', schema: 'public', table: 'custom_table' },
      { autoMigrate: false },
    )
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'postgres',
      class: 'cloud',
      address: { database: 'app', schema: 'public', table: 'custom_table' },
      options: { autoMigrate: false },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(postgresStoreDescriptor({ table: 'noydb_envelopes' }))).toThrow()
  })

  it('resolving without binding.client throws the Rule 2 error', () => {
    const locator = createStoreLocator()
    registerPostgresStore(locator)
    const descriptor = postgresStoreDescriptor({ table: 'noydb_envelopes' })
    expect(() => locator.resolve(descriptor, {})).toThrow(/binding\.client/)
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-postgres (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerPostgresStore(locator)
  return locator.resolve(postgresStoreDescriptor({}), {
    binding: { client: mockClient() },
  })
})
