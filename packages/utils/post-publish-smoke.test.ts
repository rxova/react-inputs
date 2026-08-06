import { describe, expect, it } from 'vitest'

import { importableReactPackages, parsePublishedPackages } from './post-publish-smoke'

describe('post-publish smoke input', () => {
  it('accepts the changesets/action output shape', () => {
    expect(
      parsePublishedPackages(
        JSON.stringify([
          { name: '@rxova/react-otp-input', version: '1.2.3' },
          { name: '@rxova/codemod', version: '0.2.0' },
        ]),
      ),
    ).toEqual([
      { name: '@rxova/react-otp-input', version: '1.2.3' },
      { name: '@rxova/codemod', version: '0.2.0' },
    ])
  })

  it('rejects empty, malformed and out-of-scope output', () => {
    expect(() => parsePublishedPackages('[]')).toThrow('no published packages')
    expect(() => parsePublishedPackages('not json')).toThrow()
    expect(() =>
      parsePublishedPackages(JSON.stringify([{ name: 'left-pad', version: '1.0.0' }])),
    ).toThrow('invalid published package')
  })

  it('imports only the React packages after installation', () => {
    const packages = parsePublishedPackages(
      JSON.stringify([
        { name: '@rxova/react-inputs', version: '1.0.0' },
        { name: '@rxova/codemod', version: '1.0.0' },
      ]),
    )
    expect(importableReactPackages(packages).map(({ name }) => name)).toEqual([
      '@rxova/react-inputs',
    ])
  })
})
