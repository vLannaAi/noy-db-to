import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import { registerSshStore, sshStoreDescriptor } from '../src/index.js'
import { mockSftp } from './_mock.js'

// noy-db-to#58 — opaque-client tier: a credentialless, JSON-serializable
// descriptor reconstructs the store via the locator; the live connection
// (this store has no client library of its own) rides the device-local
// `binding.client` slot, never the descriptor.

describe('to-ssh — store-locator descriptor (#58)', () => {
  it('resolves a working NoydbStore from a descriptor', async () => {
    const locator = createStoreLocator()
    registerSshStore(locator)
    const descriptor = sshStoreDescriptor({ host: 'box.example.com', port: 22, path: 'noydb' })
    const store = await locator.resolve(descriptor, { binding: { client: mockSftp() } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = sshStoreDescriptor(
      { host: 'box.example.com', port: 2222, path: 'custom' },
      { name: 'my-ssh' },
    )
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'ssh',
      class: 'lan',
      address: { host: 'box.example.com', port: 2222, path: 'custom' },
      options: { name: 'my-ssh' },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(sshStoreDescriptor({}))).toThrow()
  })

  it('resolving without binding.client throws the Rule 2 error', () => {
    const locator = createStoreLocator()
    registerSshStore(locator)
    const descriptor = sshStoreDescriptor({})
    expect(() => locator.resolve(descriptor, {})).toThrow(/binding\.client/)
  })

  it('address.path maps to remotePath, not the default', async () => {
    const locator = createStoreLocator()
    registerSshStore(locator)
    const client = mockSftp()
    const descriptor = sshStoreDescriptor({ path: 'custom-root' })
    const store = await locator.resolve(descriptor, { binding: { client } })
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect([...client.files.keys()]).toContain('/custom-root/v/c/a.json')
    expect([...client.files.keys()]).not.toContain('/noydb/v/c/a.json')
  })
})

// ─── Full conformance suite against a descriptor-resolved store ──────
runStoreConformanceTests('to-ssh (descriptor-resolved via store locator)', async () => {
  const locator = createStoreLocator()
  registerSshStore(locator)
  return locator.resolve(sshStoreDescriptor({}), {
    binding: { client: mockSftp() },
  })
})
