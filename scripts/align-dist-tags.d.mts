/**
 * Types for `align-dist-tags.mjs`'s pure half.
 *
 * The module guards its executable body behind an `isMain` check, so importing
 * it reads no registry and writes no tag. Only the derivation is exported —
 * the execute half (npm whoami, dist-tag add, registry verification) is
 * inherently integration and is proven by the release job, not by a unit test.
 */

/**
 * Every published `to-*` package name, derived from the filesystem.
 *
 * Flat and sorted — NOT grouped by peer floor. `check-peer-floor.mjs`'s
 * `planGroups()` lives next door and returns two groups for this repo's two
 * distinct floors; every package gets the same stable version on both dist
 * tags, so grouping here would tag in two passes for no reason.
 *
 * Private packages are excluded.
 */
export function publishedPackages(): string[]

/** What to do with one package, decided from its current dist-tags alone. */
export function decideAction(
  tags: { latest?: string; next?: string } | null | undefined,
  version: string,
): { action: 'refuse' | 'skip' | 'move'; reason: string }
