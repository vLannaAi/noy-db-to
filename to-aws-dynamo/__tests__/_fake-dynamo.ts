import type { DynamoDocClient } from '../src/index.js'

/**
 * Full in-memory DynamoDB document-client fake for the conformance suite
 * (#26). Models what the store emits: the single-table `pk`/`sk` layout,
 * conditional puts (`#v = :expected OR attribute_not_exists(pk)` →
 * `ConditionalCheckFailedException`), and sk-sorted Query with
 * `Limit`/`ExclusiveStartKey`/`LastEvaluatedKey` pagination — the property
 * `listPage()`'s base64 cursor rides on.
 */
export function fakeDynamo(): { client: DynamoDocClient; items: Map<string, Record<string, unknown>> } {
  const items = new Map<string, Record<string, unknown>>()
  const key = (pk: string, sk: string) => `${pk}\x00${sk}`

  const conditionalCheckFailed = () => {
    const e = new Error('The conditional request failed')
    e.name = 'ConditionalCheckFailedException'
    return e
  }

  const client: DynamoDocClient = {
    async send(command: unknown) {
      const name = (command as { constructor?: { name?: string } }).constructor?.name ?? 'Unknown'
      const input = (command as { input?: Record<string, unknown> }).input ?? {}

      if (name === 'PutCommand') {
        const item = input['Item'] as Record<string, unknown>
        const k = key(item['pk'] as string, item['sk'] as string)
        const condition = input['ConditionExpression'] as string | undefined
        if (condition === '#v = :expected OR attribute_not_exists(pk)') {
          const expected = (input['ExpressionAttributeValues'] as Record<string, unknown>)[':expected']
          const current = items.get(k)
          if (current && current['_v'] !== expected) throw conditionalCheckFailed()
        } else if (condition !== undefined) {
          throw new Error(`fake dynamo: unmodelled ConditionExpression: ${condition}`)
        }
        items.set(k, item)
        return {}
      }
      if (name === 'GetCommand') {
        const k = input['Key'] as { pk: string; sk: string }
        return { Item: items.get(key(k.pk, k.sk)) }
      }
      if (name === 'DeleteCommand') {
        const k = input['Key'] as { pk: string; sk: string }
        items.delete(key(k.pk, k.sk))
        return {}
      }
      if (name === 'QueryCommand') {
        const values = input['ExpressionAttributeValues'] as Record<string, unknown>
        const pk = values[':pk'] as string
        const prefix = (values[':prefix'] as string | undefined) ?? ''
        const limit = (input['Limit'] as number | undefined) ?? Infinity
        const start = input['ExclusiveStartKey'] as { pk: string; sk: string } | undefined
        const matched = [...items.values()]
          .filter(it => it['pk'] === pk && (it['sk'] as string).startsWith(prefix))
          .filter(it => !start || (it['sk'] as string) > start.sk)
          .sort((a, b) => ((a['sk'] as string) < (b['sk'] as string) ? -1 : 1))
        const page = matched.slice(0, limit)
        const truncated = matched.length > page.length
        return {
          Items: page,
          ...(truncated
            ? { LastEvaluatedKey: { pk, sk: page[page.length - 1]!['sk'] } }
            : {}),
        }
      }
      throw new Error(`fake dynamo: unexpected command ${name}`)
    },
  }
  return { client, items }
}
