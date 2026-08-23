import { describe, it, expect } from 'vitest'
import type { EncryptedEnvelope } from '@noy-db/hub/to'
import { fakeS3 } from './_fake-s3.js'
import { toAwsS3 } from '../src/index.js'

/**
 * #17 — the key layout is a DEPLOYMENT CONTRACT, not an implementation
 * detail. A direct-to-cloud client is confined to its own vault by an IAM
 * key-prefix condition written against exactly the keys produced here.
 * If the layout moves, every deployed policy silently stops matching — so
 * the README documents it and this file is what keeps the README honest.
 *
 * These assertions exist to FAIL if the layout changes. Changing them to
 * match new behaviour is a breaking change to every deployed IAM policy
 * AND relocates every existing object.
 */

const envelope: EncryptedEnvelope = {
  _noydb: 1,
  _v: 1,
  _ts: '2026-08-21T00:00:00.000Z',
  _iv: '',
  _data: '',
}

const keysAfterPut = async (prefix?: string): Promise<string[]> => {
  const { client, objects } = fakeS3()
  const store = toAwsS3({ client, bucket: 'b', ...(prefix !== undefined && { prefix }) })
  await store.put('alice', 'docs', 'd1', envelope)
  return [...objects.keys()]
}

describe('to-aws-s3 — published key layout (#17)', () => {
  it('writes `{vault}/{collection}/{id}.json` with no prefix', async () => {
    expect(await keysAfterPut()).toEqual(['alice/docs/d1.json'])
  })

  it('writes `{prefix}/{vault}/{collection}/{id}.json` with a prefix', async () => {
    expect(await keysAfterPut('tenant-a')).toEqual(['tenant-a/alice/docs/d1.json'])
  })

  it('DOES NOT normalise a trailing slash — `tenant-a/` yields an EMPTY path segment', async () => {
    // Pinned as OBSERVED behaviour, not as endorsed behaviour. The separator
    // is appended unconditionally (src/index.ts:106), so a prefix that already
    // ends in `/` produces `tenant-a//alice/...`.
    //
    // This matters twice over:
    //   1. `tenant-a` and `tenant-a/` address DIFFERENT objects, so changing
    //      one to the other in a config silently orphans every existing record.
    //   2. a policy written against `tenant-a/{vault}/*` finds the vault in
    //      segment 3, not segment 2.
    //
    // The README documents `prefix` as slash-free. Normalising it in code
    // would RELOCATE data for anyone already running a trailing slash, so it
    // is a separate decision — not a docs fix. See #109.
    expect(await keysAfterPut('tenant-a/')).toEqual(['tenant-a//alice/docs/d1.json'])
  })

  it('keeps the vault as the FIRST segment after the prefix, so a prefix condition can confine a client', async () => {
    const { client, objects } = fakeS3()
    const store = toAwsS3({ client, bucket: 'b', prefix: 'tenant-a' })
    await store.put('alice', 'docs', 'd1', envelope)
    await store.put('bob', 'docs', 'd1', envelope)

    expect([...objects.keys()].sort()).toEqual([
      'tenant-a/alice/docs/d1.json',
      'tenant-a/bob/docs/d1.json',
    ])
  })

  it('places the clock sentinel OUTSIDE any vault, so a vault-scoped policy denies it', async () => {
    // Same class as to-aws-dynamo's `__ping__` partition: a client confined
    // to `tenant-a/alice/*` cannot reach `tenant-a/_noydb-clock`, so
    // getStoreTime() fails under exactly the scoping #17 asks for.
    //
    // NOTE the call is getStoreTime(), NOT ping() — ping() writes nothing,
    // so asserting over its keys passes vacuously against an empty set.
    const { client, objects } = fakeS3()
    const store = toAwsS3({ client, bucket: 'b', prefix: 'tenant-a' })
    await store.getStoreTime!()

    // Assert the COUNT first: an empty set must not read as a pass.
    const keys = [...objects.keys()]
    expect(keys).toHaveLength(1)
    expect(keys[0]).toBe('tenant-a/_noydb-clock')
    expect(keys[0]).not.toContain('/alice/')
  })
})
