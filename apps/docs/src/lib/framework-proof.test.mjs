import { describe, expect, it } from 'vitest'

import {
  frameworkCompatibility,
  frameworkCompatibilityMarkdown,
  frameworkCompatibilityRows,
} from './framework-proof.mjs'

describe('framework compatibility proof', () => {
  it('derives the public matrix from every fixture manifest', () => {
    expect(frameworkCompatibility.map(({ label }) => label)).toEqual([
      'Vite',
      'Next.js',
      'Remix lineage (React Router)',
    ])
    expect(frameworkCompatibility.every(({ version }) => version.length > 0)).toBe(true)
  })

  it('fails if a fixture disappears', () => {
    expect(() => frameworkCompatibilityRows({})).toThrow('missing compatibility fixture')
  })

  it('renders the same rows for agent-facing markdown', () => {
    const markdown = frameworkCompatibilityMarkdown()
    for (const { label, version } of frameworkCompatibility) {
      expect(markdown).toContain(`| ${label} | \`${version}\``)
    }
  })
})
