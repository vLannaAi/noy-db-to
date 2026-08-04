/**
 * **@noy-db/to-rest** — NoydbStore client for the `@noy-db/in-rest`
 * ciphertext RPC proxy.
 *
 * The HTTP mirror of `@noy-db/by-peer`'s `peerStore()`: every store
 * method is serialized as `POST {baseUrl}/rpc` with `{ method, args }`,
 * where `args` is the store method's positional tuple, exactly as the
 * `NoydbStore` signature. The server (an `@noy-db/in-rest`
 * `createRestHandler`) funnels the RPC into its own backing store —
 * it forwards ciphertext envelopes verbatim and never sees a
 * passphrase or plaintext (noy-db#963 finding-2 architecture).
 *
 * ```ts
 * import { toRest } from '@noy-db/to-rest'
 *
 * const store = toRest({
 *   baseUrl: 'https://vault.example.com/api',
 *   headers: { authorization: `Bearer ${API_KEY}` },
 * })
 * const db = await createNoydb({ store })
 * ```
 *
 * ## Wire contract (server: `@noy-db/in-rest` >= 0.6.0-pre.0)
 *
 * | Server response | Client behavior |
 * |---|---|
 * | `200` | JSON result, returned as-is |
 * | `409 { error: { name: 'ConflictError', version } }` | re-thrown as `ConflictError(version)` — CAS semantics survive the wire hop |
 * | `401` | auth error (the server's `authorize` is fail-closed — send the header it expects) |
 * | `403` | capability error (method not in the server's `allow` set) |
 * | `501` | the server's backing store lacks this optional method |
 * | other  | server/store error carrying the error NAME only (the server never echoes internals) |
 *
 * ## Capabilities
 *
 * | Capability  | Value |
 * |-------------|-------|
 * | `casAtomic` | `true` — `expectedVersion` rides the wire; the server's backing store enforces it and the 409 envelope re-hydrates `ConflictError` |
 * | `listPage` / `listVaults` / `listSince` | pass-throughs — the server answers `501` when its backing store lacks them |
 * | `ping`      | ✓ — RPC `ping`; returns `false` on any transport failure |
 *
 * @packageDocumentation
 */

import type { NoydbStore, EncryptedEnvelope, VaultSnapshot, ListPageResult } from '@noy-db/hub/to'
import { ConflictError } from '@noy-db/hub/to'

export interface RestStoreOptions {
  /** Base URL the in-rest handler is mounted at (with or without trailing slash); `/rpc` is appended. */
  readonly baseUrl: string
  /**
   * Headers sent with every request — supply whatever the server's
   * fail-closed `authorize` expects (typically `{ authorization: 'Bearer …' }`).
   */
  readonly headers?: Record<string, string>
  /** Max ms to wait for any single RPC response. Default 30s. */
  readonly timeoutMs?: number
  /** Custom fetch — defaults to `globalThis.fetch`. */
  readonly fetch?: typeof fetch
}

interface WireError {
  readonly name?: string
  readonly message?: string
  readonly version?: number
}

/**
 * Create a `NoydbStore` that forwards every operation to a remote
 * `@noy-db/in-rest` RPC proxy. `dispose()` is a no-op today (reserved
 * for connection teardown, mirroring `by-peer`'s `peerStore()` shape).
 */
export function toRest(options: RestStoreOptions): NoydbStore & { dispose: () => void } {
  const { headers = {}, timeoutMs = 30_000 } = options
  const fetchImpl = options.fetch ?? globalThis.fetch
  const rpcUrl = `${options.baseUrl.replace(/\/+$/, '')}/rpc`

  async function call<T>(method: string, args: readonly unknown[]): Promise<T> {
    // JSON has no `undefined`: a trailing optional arg (expectedVersion,
    // cursor, limit) would serialize as `null` and the server would treat
    // it as a real value (e.g. `expectedVersion: null` ≠ omitted). Trim
    // trailing undefineds so optional-arg omission survives the wire.
    const tuple = [...args]
    while (tuple.length > 0 && tuple[tuple.length - 1] === undefined) tuple.pop()
    const res = await fetchImpl(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ method, args: tuple }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status === 200) {
      return (await res.json()) as T
    }
    let wire: WireError = {}
    try {
      wire = ((await res.json()) as { error?: WireError })?.error ?? {}
    } catch {
      // non-JSON error body — fall through to the generic mapping below
    }
    // Re-hydrate ConflictError so CAS semantics survive the wire hop
    // (mirrors by-peer's peer-store re-hydration).
    if (wire.name === 'ConflictError' && typeof wire.version === 'number') {
      throw new ConflictError(wire.version, wire.message)
    }
    if (res.status === 401) {
      throw new Error(
        `to-rest: unauthorized (401) — the server's authorize hook rejected the request; check the Authorization header (${wire.message ?? 'unauthorized'})`,
      )
    }
    if (res.status === 403) {
      throw new Error(`to-rest: method not allowed by the server (403): ${wire.message ?? method}`)
    }
    if (res.status === 501) {
      throw new Error(`to-rest: method not implemented by the server's backing store (501): ${wire.message ?? method}`)
    }
    throw new Error(`to-rest: server error (${res.status}): ${wire.name ?? 'Error'} — ${wire.message ?? 'store error'}`)
  }

  return {
    name: 'rest',
    capabilities: {
      // CAS is enforced server-side by the backing store: expectedVersion
      // rides the RPC tuple and a 409 envelope re-hydrates ConflictError,
      // so a CAS put has the same semantics as a direct store call.
      casAtomic: true,
      auth: { kind: 'api-key', required: true, flow: 'static' },
    },

    async get(vault, collection, id) {
      return call<EncryptedEnvelope | null>('get', [vault, collection, id])
    },

    async put(vault, collection, id, envelope, expectedVersion) {
      await call<null>('put', [vault, collection, id, envelope, expectedVersion])
    },

    async delete(vault, collection, id) {
      await call<null>('delete', [vault, collection, id])
    },

    async list(vault, collection) {
      return call<string[]>('list', [vault, collection])
    },

    async loadAll(vault) {
      return call<VaultSnapshot>('loadAll', [vault])
    },

    async saveAll(vault, data) {
      await call<null>('saveAll', [vault, data])
    },

    async ping() {
      try {
        return await call<boolean>('ping', [])
      } catch {
        return false
      }
    },

    async listSince(vault, collection, since) {
      return call('listSince', [vault, collection, since])
    },

    async listPage(vault, collection, cursor, limit) {
      return call<ListPageResult>('listPage', [vault, collection, cursor, limit])
    },

    async listVaults() {
      return call<string[]>('listVaults', [])
    },

    dispose() {
      // No persistent connection today — reserved for keep-alive teardown.
    },
  }
}
