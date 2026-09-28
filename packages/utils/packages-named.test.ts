import { describe, expect, it } from 'vitest'

import { packagesNamed } from './packages-named'

describe('packagesNamed', () => {
  it('counts packages in either quote style, with trailing comments', () => {
    expect(packagesNamed("---\n'@rxova/a': patch\n---\n")).toBe(1)
    expect(packagesNamed('---\n"@rxova/a": minor # note\n"@rxova/b": major\n---\n\nBody')).toBe(2)
  })

  it('reads nothing outside a closed frontmatter block', () => {
    expect(packagesNamed("'@rxova/a': patch\n")).toBe(0)
    expect(packagesNamed("---\n'@rxova/a': patch\n")).toBe(0)
    expect(packagesNamed('---\n---\n')).toBe(0)
  })
})
