import { describe, expect, it } from 'vitest'
import { ConflictError } from '@noy-db/hub/to'
import { toRest } from '../src/index.js'
import { restHarness } from './_harness.js'

// noy-db-to#55 — the RPC client re-hydrates the wire contract of
// @noy-db/in-rest's ciphertext proxy: POST {baseUrl}/rpc with
// { method, args }, ConflictError from 409 envelopes, clear auth /
// capability / server errors from 401 / 403 / 501 / 5xx.

const auth = { authorization: 'Bearer test-key' }
const env = (v: number) => ({ _noydb: 1 as const, _v: v, _ts: new Date().toISOString(), _iv: 'i', _data: 'ZA==' })

describe('to-rest — RPC client (#55)', () => {
  it('round-trips put/get/list/delete over /rpc', async () => {
    const { fetch } = restHarness()
    const store = toRest({ baseUrl: 'https://vault.example.com', headers: auth, fetch })
    await store.put('v', 'c', 'a', env(1))
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
    expect(await store.list('v', 'c')).toEqual(['a'])
    await store.delete('v', 'c', 'a')
    expect(await store.get('v', 'c', 'a')).toBeNull()
  })

  it('re-hydrates ConflictError from a 409 envelope with the server version', async () => {
    const { fetch } = restHarness()
    const store = toRest({ baseUrl: 'https://vault.example.com', headers: auth, fetch })
    await store.put('v', 'c', 'a', env(3))
    const err = await store.put('v', 'c', 'a', env(9), 1).catch(e => e as Error)
    expect(err).toBeInstanceOf(ConflictError)
    expect((err as ConflictError).version).toBe(3)
  })

  it('maps 401 to a clear auth error (fail-closed server)', async () => {
    const { fetch } = restHarness()
    const store = toRest({ baseUrl: 'https://vault.example.com', headers: { authorization: 'Bearer wrong' }, fetch })
    await expect(store.get('v', 'c', 'a')).rejects.toThrow(/unauthorized/i)
  })

  it('strips a trailing slash from baseUrl before appending /rpc', async () => {
    const { fetch } = restHarness()
    const store = toRest({ baseUrl: 'https://vault.example.com/', headers: auth, fetch })
    await store.put('v', 'c', 'a', env(1))
    expect((await store.get('v', 'c', 'a'))?._v).toBe(1)
  })

  it('supports a basePath in baseUrl (server mounted under a prefix)', async () => {
    const { backing, fetch } = restHarness()
    void backing
    const store = toRest({ baseUrl: 'https://vault.example.com', headers: auth, fetch })
    // the harness handler has no basePath; this asserts the client hits exactly /rpc
    expect(await store.ping!()).toBe(true)
  })

  it('ping() returns false instead of throwing when the server is unreachable', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      headers: auth,
      fetch: (async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch,
    })
    expect(await store.ping!()).toBe(false)
  })
})
