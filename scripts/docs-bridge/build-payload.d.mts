export interface CapEntry {
  factory: string
  shape: string
  capabilities: Record<string, unknown> | null
  optionDependent: boolean
  /** Capability bits whose value depends on construction options (vLannaAi/noy-db#930). */
  conditionalBits?: readonly string[]
}

export interface BuildPayloadOpts {
  rootDir: string
  caps: Record<string, CapEntry>
  tag: string
  channel: string
  runUrl: string
  isFirstPublish: (pkgName: string) => boolean
}

export interface BridgePackageEntry {
  name: string
  dir: string
  version: string
  description: string | null
  factory: string
  shape: string
  capabilities: Record<string, unknown> | null
  /**
   * Per-store txAtomic in the noy-db-docs scanner vocabulary (#39):
   * literal declaration for record stores (absent key = false),
   * 'conditional' when the declaration varies with construction options,
   * null for vault (pod) stores.
   */
  txAtomic: boolean | 'conditional' | null
  /**
   * Per-bit option-dependence (vLannaAi/noy-db#930): the capability bits whose
   * value depends on the injected client/inner store; the recorded boolean in
   * `capabilities` stays the default-configuration value. Present only when
   * non-empty (omitted, never an empty array). Consumers treat listed bits as
   * 'conditional' and skip strict divergence comparison on them.
   */
  conditionalBits?: readonly string[]
  optionDependent: boolean
  changeType: 'added' | 'updated' | 'version-only'
  changelog: string | null
}

export interface BridgePayload {
  bridge: 1
  repo: string
  version: string
  tag: string
  channel: string
  runUrl: string
  hubPeerRange: string | null
  packages: BridgePackageEntry[]
}

export function buildPayload(opts: BuildPayloadOpts): BridgePayload

/**
 * True when the payload shows real work: some package was `added`/`updated`,
 * or carries a non-empty changelog body.
 */
export function hasRealDelta(payload: BridgePayload): boolean

/**
 * True when a failed `npm view` call means the package has never been published
 * (npm's E404). Any other failure is NOT first-publish.
 */
export function isFirstPublishFromError(err: unknown): boolean

/** True when npm knows no version of this package other than the current one. */
export function npmIsFirstPublish(name: string): boolean
