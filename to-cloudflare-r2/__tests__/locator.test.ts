import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { StoreCredentials } from '@noy-db/hub/to'
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

// Coverage for credentials path: when opts.credentials is supplied to
// locator.resolve(), it must thread through to the S3Client construction.
describe('to-cloudflare-r2 — descriptor + credentials threading (#58)', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('credentials source passed to resolve() threads through to S3Client config', async () => {
    const capturedConfigs: Record<string, unknown>[] = []
    const ROLLING_CREDS: StoreCredentials = {
      kind: 'aws',
      accessKeyId: 'R2_TEST_KEY',
      secretAccessKey: 'R2_TEST_SECRET',
      expiresAt: '2026-07-20T12:00:00.000Z',
    }

    vi.doMock('@aws-sdk/client-s3', () => ({
      S3Client: class {
        constructor(config: Record<string, unknown>) {
          capturedConfigs.push(config)
        }
      },
    }))

    const { registerR2Store: regR2, r2StoreDescriptor: r2Desc } = await import('../src/index.js')
    const locator = createStoreLocator()
    regR2(locator)
    const descriptor = r2Desc({ bucket: 'cred-test', accountId: 'acc' })

    // Resolve with credentials source but NO binding.client, forcing the
    // S3Client construction path to run.
    await locator.resolve(descriptor, {
      credentials: async () => ROLLING_CREDS,
    })

    expect(capturedConfigs).toHaveLength(1)
    const config = capturedConfigs[0]
    // Prove credentials is a function (not static keys).
    expect(typeof config['credentials']).toBe('function')

    vi.doUnmock('@aws-sdk/client-s3')
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
