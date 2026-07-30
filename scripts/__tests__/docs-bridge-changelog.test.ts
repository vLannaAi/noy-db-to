import { describe, it, expect } from 'vitest'
import { extractSection } from '../docs-bridge/changelog.mjs'

const SAMPLE = `# @noy-db/to-webdav

## 0.3.0-pre.3

### Fix: something

- line one
- line two

## 0.3.0-pre.1

### Older

- old line
`

describe('extractSection', () => {
  it('extracts exactly the requested version section, trimmed', () => {
    expect(extractSection(SAMPLE, '0.3.0-pre.3')).toBe('### Fix: something\n\n- line one\n- line two')
  })

  it('extracts the last section (no trailing heading)', () => {
    expect(extractSection(SAMPLE, '0.3.0-pre.1')).toBe('### Older\n\n- old line')
  })

  it('returns null when the version has no section', () => {
    expect(extractSection(SAMPLE, '9.9.9')).toBeNull()
  })

  it('does not match versions that merely share a prefix', () => {
    expect(extractSection(SAMPLE, '0.3.0')).toBeNull()
  })
})
