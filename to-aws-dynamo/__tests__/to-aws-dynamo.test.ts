import { describe, it, expect } from 'vitest'
import type { EncryptedEnvelope } from '@noy-db/hub/to'
import { dynamo, type DynamoDocClient } from '../src/index.js'

/**
 * In-memory mock DynamoDB document client. Mirrors the single-table
 * `pk = vault`, `sk = {collection}#{id}` layout the store writes.
 */
function mockClient(): { client: DynamoDocClient } {
  const items = new Map<string, Record<string, unknown>>()
  const key = (pk: string, sk: string) => `${pk}\x00${sk}`

  const client: DynamoDocClient = {
    async send(command: unknown) {
      const name = (command as { constructor?: { name?: string } }).constructor?.name ?? 'Unknown'
      const input = (command as { input?: Record<string, unknown> }).input ?? {}

      if (name === 'PutCommand') {
        const item = input['Item'] as Record<string, unknown>
        items.set(key(item['pk'] as string, item['sk'] as string), item)
        return {}
      }
      if (name === 'GetCommand') {
        const k = input['Key'] as { pk: string; sk: string }
        const item = items.get(key(k.pk, k.sk))
        return { Item: item }
      }
      throw new Error(`Mock client got unexpected command: ${name}`)
    },
  }
  return { client }
}

describe('@noy-db/to-aws-dynamo — full-envelope round-trip', () => {
  it('round-trips a _del delete-marker envelope byte-identically', async () => {
    const { client } = mockClient()
    const adapter = dynamo({ table: 't', client })

    const envelope: EncryptedEnvelope = {
      _noydb: 1,
      _v: 2,
      _ts: '2026-07-09T00:00:00.000Z',
      _iv: '',
      _data: '',
      _del: true,
    }
    await adapter.put('v1', 'c1', 'del1', envelope)
    const result = await adapter.get('v1', 'c1', 'del1')
    expect(result).toEqual(envelope)
  })

  it('round-trips a maximal envelope byte-identically (every field survives, not just _del)', async () => {
    const { client } = mockClient()
    const adapter = dynamo({ table: 't', client })

    const envelope: EncryptedEnvelope = {
      _noydb: 1,
      _v: 3,
      _ts: '2026-07-09T00:00:00.000Z',
      _iv: 'dGVzdC1pdg==',
      _data: 'Y2lwaGVydGV4dA==',
      _by: 'alice',
      _tier: 2,
      _elevatedBy: 'bob',
      _det: { email: 'abc:def' },
      _cek: 'wrapped-cek-b64',
      _debug: 1,
      _del: true,
    }
    await adapter.put('v1', 'c1', 'maximal1', envelope)
    const result = await adapter.get('v1', 'c1', 'maximal1')
    expect(result).toEqual(envelope)
  })
})
