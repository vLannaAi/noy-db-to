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

  // #114 — noy-db #1218 will drop `version` from in-rest's 409 body (it
  // discloses another writer's progress counter). These cases pin the
  // FUTURE payload, so this client keeps producing a ConflictError once
  // the field is gone. They cannot use `restHarness`: it serves a live
  // `createRestHandler`, which always emits `version` — no published
  // in-rest can produce this body yet, so the 409 is hand-rolled.
  // Mirrors hub's `isConflictError` — the predicate every store-boundary
  // catch is required to use (hub #935: `instanceof` is unreliable across
  // this seam). It is NOT imported: hub exports it from the ROOT barrel
  // only, never from `@noy-db/hub/to`, and a store may bind only `/to`
  // (verified against hub 0.7.0-pre.2 and the 0.7.0-pre.0 peer floor).
  const isConflictError = (err: unknown): boolean =>
    err instanceof ConflictError || (err instanceof Error && err.name === 'ConflictError')

  const conflict409 = (body: Record<string, unknown>) =>
    (async () =>
      new Response(JSON.stringify({ error: body }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch

  it('re-hydrates ConflictError from a 409 that omits `version` (NaN, never a fabricated version)', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      headers: auth,
      fetch: conflict409({ name: 'ConflictError', message: 'Version conflict' }),
    })
    const err = await store.put('v', 'c', 'a', env(9), 1).catch(e => e as Error)
    expect(err).toBeInstanceOf(ConflictError)
    expect(isConflictError(err)).toBe(true)
    // NaN, not a sentinel: no comparison against it can accidentally
    // succeed, and it cannot masquerade as a real stored version.
    expect((err as ConflictError).version).toBeNaN()
  })

  it('treats a null `version` the same as an absent one (JSON has no undefined)', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      headers: auth,
      fetch: conflict409({ name: 'ConflictError', message: 'Version conflict', version: null }),
    })
    const err = await store.put('v', 'c', 'a', env(9), 1).catch(e => e as Error)
    expect(isConflictError(err)).toBe(true)
    expect((err as ConflictError).version).toBeNaN()
  })

  // Negative control: loosening the guard must not turn every 409 into a
  // ConflictError. Without this, the two cases above pass just as well
  // against a guard that swallowed the status code wholesale.
  it('does NOT re-hydrate a 409 whose error name is something else', async () => {
    const store = toRest({
      baseUrl: 'https://vault.example.com',
      headers: auth,
      fetch: conflict409({ name: 'QuotaExceededError', message: 'over quota' }),
    })
    const err = await store.put('v', 'c', 'a', env(9), 1).catch(e => e as Error)
    expect(isConflictError(err)).toBe(false)
    expect(err.message).toMatch(/server error \(409\): QuotaExceededError/)
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
