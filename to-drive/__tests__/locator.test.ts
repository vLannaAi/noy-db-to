import { describe, expect, it } from 'vitest'
import { createStoreLocator } from '@noy-db/hub/to'
import { wrapPodStore } from '@noy-db/hub/pod'
import { runStoreConformanceTests } from '@noy-db/test-adapter-conformance'
import type { NoydbPodStore } from '@noy-db/hub/to'
import { registerDriveStore, driveStoreDescriptor } from '../src/index.js'
import { mockDrive } from './_mock.js'

// noy-db-to#58 — binding-slot tier: a credentialless, JSON-serializable
// descriptor reconstructs the store via the locator; the live `DriveClient`
// (this store has no client library of its own) rides the device-local
// `binding.client` slot, never the descriptor.
//
// `toDrive()` returns a `NoydbPodStore`, not a `NoydbStore` — same as
// `__tests__/conformance.test.ts`, the six-method contract is reached by
// wrapping the resolved store with `wrapPodStore()`, not via
// `runStoreConformanceTests`'s default put/get expectations directly on
// the locator's declared (but here inapplicable) `NoydbStore` return type.

describe('to-drive — store-locator descriptor (#58)', () => {
  it('resolves a working store from a descriptor (bundle round-trip)', async () => {
    const locator = createStoreLocator()
    registerDriveStore(locator)
    const descriptor = driveStoreDescriptor({})
    const pod = await locator.resolve(descriptor, { binding: { client: mockDrive() } }) as unknown as NoydbPodStore
    const store = wrapPodStore(pod)
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('descriptor is JSON-serializable and credentialless by construction', () => {
    const descriptor = driveStoreDescriptor(
      { parentId: 'folder-123' },
      { suffix: '.custom' },
    )
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor)
    expect(descriptor).toEqual({
      kind: 'drive',
      class: 'cloud',
      address: { parentId: 'folder-123' },
      options: { suffix: '.custom' },
    })
  })

  it('an unregistered kind fails resolve loudly', () => {
    const locator = createStoreLocator()
    expect(() => locator.resolve(driveStoreDescriptor({}))).toThrow()
  })

  it('resolving without binding.client throws the guard error', () => {
    const locator = createStoreLocator()
    registerDriveStore(locator)
    const descriptor = driveStoreDescriptor({})
    expect(() => locator.resolve(descriptor, {})).toThrow(/binding\.client/)
  })

  it('address.parentId reaches the injected Drive client, never a read-back through the store', async () => {
    const locator = createStoreLocator()
    registerDriveStore(locator)
    const client = mockDrive()
    const descriptor = driveStoreDescriptor({ parentId: 'custom-parent-id' })
    const pod = await locator.resolve(descriptor, { binding: { client } }) as unknown as NoydbPodStore
    const store = wrapPodStore(pod)
    const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }
    await store.put('v', 'c', 'a', envelope)
    const created = [...client.files.values()]
    expect(created.length).toBeGreaterThan(0)
    expect(created.every(f => f.parents.includes('custom-parent-id'))).toBe(true)
  })
})

// ─── Full conformance suite against a descriptor-resolved, wrapped store ─
runStoreConformanceTests('to-drive (descriptor-resolved via store locator, wrapped)', async () => {
  const locator = createStoreLocator()
  registerDriveStore(locator)
  const descriptor = driveStoreDescriptor({})
  const pod = await locator.resolve(descriptor, { binding: { client: mockDrive() } }) as unknown as NoydbPodStore
  return wrapPodStore(pod)
})
