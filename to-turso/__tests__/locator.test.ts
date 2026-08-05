import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import type { StoreCredentials } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerTursoStore, tursoStoreDescriptor } from '../src/index.js'
import { libsqlOverNodeSqlite } from './_engine.js'

// noy-db-to#58 — opaque-client tier: a credentialless, JSON-serializable
// descriptor reconstructs the store via the locator; the live connection
// (this store has no client library of its own by default) rides the
// device-local `binding.client` slot, never the descriptor. `to-turso` is
// the one store in this tier that CAN also build its own connection, given
// `binding.clientFactory` plus `opts.credentials`.

describe('to-turso — store-locator descriptor (#58)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerTursoStore(locator)
    const descriptor = tursoStoreDescriptor({ url: 'libsql://app.turso.io', table: 'noydb_envelopes' })
    const store = await locator.resolve(descriptor, { binding: { client: libsqlOverNodeSqlite() } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = tursoStoreDescriptor(
      { url: 'libsql://app.turso.io', table: 'custom_table' },
      { autoMigrate: false, clockUncertaintyMs: 2000 },
    )
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'turso',
      class: 'cloud',
      address: { url: 'libsql://app.turso.io', table: 'custom_table' },
      options: { autoMigrate: false, clockUncertaintyMs: 2000 },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(tursoStoreDescriptor({ url: 'libsql://app.turso.io' }))).toThrow()
  })

  it('resolving without binding.client or binding.clientFactory throws the Rule 2 error', () => {
    const locator = createStoreLocator()
    registerTursoStore(locator)
    const descriptor = tursoStoreDescriptor({ url: 'libsql://app.turso.io' })
    expect(() => locator.resolve(descriptor, {})).toThrow(/binding\.client/)
  })

  it('resolving a hand-built descriptor missing address.url throws a clear error', () => {
    const locator = createStoreLocator()
    registerTursoStore(locator)
    const descriptor = { kind: 'turso', class: 'cloud', address: {} }
    expect(() => locator.resolve(descriptor, { binding: { client: libsqlOverNodeSqlite() } })).toThrow(/address\.url/)
  })

  it('address.table maps to tableName, not the default', async () => {
    const locator = createStoreLocator()
    registerTursoStore(locator)
    const client = libsqlOverNodeSqlite()
    const descriptor = tursoStoreDescriptor({ url: 'libsql://app.turso.io', table: 'custom_table' })
    const store = await locator.resolve(descriptor, { binding: { client } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    const { rows } = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
    const tables = (rows as { name: string }[]).map(r => r.name)
    expect(tables).toContain('custom_table')
    expect(tables).not.toContain('noydb_envelopes')
  })

  it('resolves via binding.clientFactory + opts.credentials (the constructible path)', async () => {
    const locator = createStoreLocator()
    registerTursoStore(locator)
    const descriptor = tursoStoreDescriptor({ url: 'libsql://app.turso.io' })
    const tokens: string[] = []
    const clientFactory = (authToken: string) => {
      tokens.push(authToken)
      return libsqlOverNodeSqlite()
    }
    const credentials = async (): Promise<StoreCredentials> => ({ kind: 'token', token: 'tok-1' })
    const store = await locator.resolve(descriptor, { binding: { clientFactory }, credentials })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
    expect(tokens).toEqual(['tok-1'])
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-turso (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerTursoStore(locator)
  return locator.resolve(tursoStoreDescriptor({ url: 'libsql://app.turso.io' }), {
    binding: { client: libsqlOverNodeSqlite() },
  })
})
