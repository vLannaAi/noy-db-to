import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(here, '..', 'check-architecture.mjs')
const COMPLIANT = join(here, 'fixtures', 'compliant')
const VIOLATING = join(here, 'fixtures', 'violating')

function run(root: string): { code: number; out: string } {
  try {
    const out = execFileSync('node', [SCRIPT], {
      env: { ...process.env, ARCH_ROOT: root },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out }
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string }
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

describe('noy-db-to architecture guard', () => {
  it('passes a compliant store (peer range + /to import)', () => {
    const { code } = run(COMPLIANT)
    expect(code).toBe(0)
  })

  it('fails a store that peers workspace:* and imports the main barrel', () => {
    const { code, out } = run(VIOLATING)
    expect(code).toBe(1)
    expect(out).toContain('hub-peer-range')
    expect(out).toContain('to-only')
    expect(out).toContain('no-crypto-deps')
  })
})
