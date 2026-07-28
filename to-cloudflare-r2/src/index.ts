/**
 * **@noy-db/to-cloudflare-r2** — Cloudflare R2 adapter for noy-db.
 *
 * R2 is S3-API-compatible, so this package is a thin factory that
 * configures `@noy-db/to-aws-s3` to point at the R2 endpoint and
 * pass the R2-specific access key signature. Inherits all capabilities
 * from `toAwsS3()` — `casAtomic: true`, `serverWriteTime: true`, server-clock
 * sampling via `LastModified`, and `IfMatch`/`IfNoneMatch` conditional CAS.
 *
 * ## Why R2 for noy-db?
 *
 * - **Zero egress fees** — backup/archive workflows that stream the
 *   whole vault on a schedule cost nothing to read back.
 * - **S3-compatible** — no new API surface; same SDK, same commands.
 * - **Workers edge** — pair with `@noy-db/to-cloudflare-d1` for a
 *   pure-edge noy-db deployment.
 *
 * ## Account-id vs endpoint
 *
 * The simplest configuration passes your Cloudflare account id and
 * the bucket name:
 *
 * ```ts
 * import { toCloudflareR2 } from '@noy-db/to-cloudflare-r2'
 *
 * const store = toCloudflareR2({
 *   accountId: 'abc123…',       // Cloudflare dashboard → R2 → account id
 *   bucket: 'my-noydb-bucket',
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID!,
 *   secretAccessKey: process.env.R2_SECRET!,
 * })
 * ```
 *
 * Consumers who already have a configured `S3Client` (common in Workers
 * / multi-region setups) can pass it via `client`; the rest of the
 * options are ignored.
 *
 * @packageDocumentation
 */

import type { NoydbStore, StoreCredentialSource } from '@noy-db/hub/to'
import type { S3Client, S3ClientConfig } from '@aws-sdk/client-s3'
import { S3Client as RealS3Client } from '@aws-sdk/client-s3'
import { toAwsS3, mapAws } from '@noy-db/to-aws-s3'

export interface R2Options {
  /** Cloudflare account id (from the R2 dashboard). Required unless `client` is supplied. */
  readonly accountId?: string
  /** R2 bucket name. */
  readonly bucket: string
  /** Key prefix within the bucket. Default `''`. */
  readonly prefix?: string
  /**
   * R2 access key id. Required unless `client` or `credentials` is
   * supplied. Prefer short-lived credentials via the account's API
   * token flow.
   */
  readonly accessKeyId?: string
  /** R2 secret access key. Required unless `client` or `credentials` is supplied. */
  readonly secretAccessKey?: string
  /**
   * Rolling short-lived credentials source (the hub's #479 credential-broker
   * seam). R2 keys are S3-compatible, so the provider must yield
   * `kind: 'aws'` credentials; the SDK re-invokes it near `expiresAt`.
   * Takes precedence over the static `accessKeyId`/`secretAccessKey` pair;
   * ignored when `client` is supplied (a pre-built client always wins).
   */
  readonly credentials?: StoreCredentialSource
  /**
   * Pre-built S3Client — overrides every other authentication option.
   * Use this when you already share an R2-pointed client across adapters
   * or run in Cloudflare Workers with an injected binding.
   */
  readonly client?: S3Client
  /** Override the endpoint. Default derived from `accountId`. */
  readonly endpoint?: string
  /** Clock uncertainty bound for serverWriteTime (ms). Forwarded to toAwsS3(). Default: 5000. */
  clockUncertaintyMs?: number
}

const R2_REGION = 'auto'

/**
 * Build the default R2 endpoint URL for a Cloudflare account.
 * The public form is documented as:
 *   `https://<accountId>.r2.cloudflarestorage.com`
 */
export function r2EndpointFor(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`
}

/**
 * Create a noy-db store backed by Cloudflare R2. Delegates to
 * `@noy-db/to-aws-s3`'s `toAwsS3()` with R2-specific endpoint + region
 * configured.
 */
export function toCloudflareR2(options: R2Options): NoydbStore {
  if (options.client) {
    const opts: Parameters<typeof toAwsS3>[0] = {
      bucket: options.bucket,
      ...(options.prefix !== undefined && { prefix: options.prefix }),
      client: options.client,
      ...(options.clockUncertaintyMs !== undefined && { clockUncertaintyMs: options.clockUncertaintyMs }),
    }
    return {
      ...toAwsS3(opts),
      name: 'cloudflare-r2',
      capabilities: {
        casAtomic: true,
        serverWriteTime: true,
        auth: { kind: 'api-key', required: true, flow: 'static' },
      },
    }
  }

  if (!options.accountId) {
    throw new Error('@noy-db/to-cloudflare-r2: provide either `client` or `accountId`.')
  }
  if (!options.credentials && (!options.accessKeyId || !options.secretAccessKey)) {
    throw new Error('@noy-db/to-cloudflare-r2: `accessKeyId` and `secretAccessKey` (or a `credentials` source) are required (unless `client` is supplied).')
  }

  const endpoint = options.endpoint ?? r2EndpointFor(options.accountId)
  const config: S3ClientConfig = {
    region: R2_REGION,
    endpoint,
    credentials: options.credentials
      ? async () => mapAws(await options.credentials!())
      : {
          accessKeyId: options.accessKeyId!,
          secretAccessKey: options.secretAccessKey!,
        },
    forcePathStyle: true,
  }
  const built = new RealS3Client(config)
  const opts: Parameters<typeof toAwsS3>[0] = {
    bucket: options.bucket,
    ...(options.prefix !== undefined && { prefix: options.prefix }),
    client: built,
    ...(options.clockUncertaintyMs !== undefined && { clockUncertaintyMs: options.clockUncertaintyMs }),
  }
  return {
    ...toAwsS3(opts),
    name: 'cloudflare-r2',
    capabilities: {
      casAtomic: true,
      serverWriteTime: true,
      auth: { kind: 'api-key', required: true, flow: 'static' },
    },
  }
}
