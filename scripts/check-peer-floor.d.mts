/**
 * Types for `check-peer-floor.mjs`'s pure "plan" half.
 *
 * The module guards its executable body behind an `isMain` check, so importing
 * it installs nothing and only these four functions are reachable. The
 * "execute" half (install + build + typecheck per floor) has no exported
 * surface by design — a fixture faking a floor failure would only test the
 * fixture; the CI job is what proves that half.
 */

/** One package grouped under a floor. */
export interface FloorMember {
  name: string
  dir: string
  range: string
}

/** Absolute paths of every `to-*` directory that carries a `package.json`. */
export function storeDirs(): string[]

/**
 * The lowest version a range admits, or `null` when there is no such version.
 *
 * Returns null — never throws — for all three of `semver.minVersion`'s failure
 * modes: a malformed range (which throws), a well-formed but unsatisfiable one
 * (which returns null), and an unbounded one (`*`, `x`, blank), which semver
 * floors at `0.0.0`, a version no `@noy-db` package has published.
 */
export function floorOf(range: unknown): string | null

/**
 * The root `package.json` text with `pnpm.overrides['@noy-db/hub']` pinned to
 * `floor`. Pure: the caller keeps the original bytes and restores them
 * verbatim rather than re-serialising.
 */
export function pinnedRootText(originalText: string, floor: string): string

/** Packages grouped by the minimum hub version their peer range admits. */
export function planGroups(): Map<string, FloorMember[]>
