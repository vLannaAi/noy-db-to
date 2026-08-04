import { describe, expect, it } from 'vitest'
import type { StoreCredentials } from '@noy-db/hub/to'
import { toRest } from '../src/index.js'
import { restHarness } from './_harness.js'

const envelope = { _noydb: 1 as const, _v: 1, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' }

describe('to-rest — credential broker (#58)', () => {
  it('sends a bearer token from a credential source', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      credentials: async () => ({ kind: 'token', token: 'test-key' }),
      fetch: restHarness().fetch,
    })
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('re-invokes the source on every request, so rolling tokens work', async () => {
    let calls = 0
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      credentials: async () => {
        calls++
        return { kind: 'token', token: 'test-key' }
      },
      fetch: restHarness().fetch,
    })
    await store.put('v', 'c', 'a', envelope)
    await store.get('v', 'c', 'a')
    expect(calls).toBe(2)
  })

  it('credentials override an authorization header supplied via headers', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      headers: { authorization: 'Bearer WRONG', 'x-tenant': 'acme' },
      credentials: async () => ({ kind: 'token', token: 'test-key' }),
      fetch: restHarness().fetch,
    })
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('rejects a credential kind other than token', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      credentials: async () => ({ kind: 'aws', accessKeyId: 'k', secretAccessKey: 's' }) as StoreCredentials,
      fetch: restHarness().fetch,
    })
    await expect(store.get('v', 'c', 'a')).rejects.toThrow(/kind 'aws'/)
  })

  it('still works with a static authorization header and no credentials', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      headers: { authorization: 'Bearer test-key' },
      fetch: restHarness().fetch,
    })
    await store.put('v', 'c', 'a', envelope)
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })
})
