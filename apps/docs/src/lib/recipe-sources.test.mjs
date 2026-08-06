import { describe, expect, it } from 'vitest'

import { componentPackages } from '../../../../packages/utils/component-packages.mjs'
import {
  checkRecipeCoverage,
  recipeLibraries,
  recipeSources,
  recipesFor,
} from './recipe-sources.mjs'

describe('integration recipe sources', () => {
  it('provides every library for a component', () => {
    const sources = new Map(recipeLibraries.map(({ id }) => [`${id}/otp`, `// ${id}`]))
    expect(recipesFor('otp', sources).map(({ id }) => id)).toEqual(
      recipeLibraries.map(({ id }) => id),
    )
  })

  it('fails loudly on a missing recipe', () => {
    expect(() => recipesFor('otp', new Map())).toThrow('missing shadcn/ui recipe')
  })

  it('covers every component in this repository with no orphaned source', () => {
    const result = checkRecipeCoverage(componentPackages(), recipeSources)
    expect(result.missing).toEqual([])
    expect(result.orphans).toEqual([])
    expect(result.expected).toBe(componentPackages().length * recipeLibraries.length)
  })
})
