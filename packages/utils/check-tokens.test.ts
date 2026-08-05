/**
 * The failure this gate exists for is a near-miss prefix: `--rphi-gap` on the
 * phone field when the password field next to it reads `--rpi-gap`. Custom
 * properties inherit, so the wrong one is silently inert rather than an error,
 * and nothing else in the repo would ever say so. The tests that matter are
 * therefore the ones asserting it FAILS — a namespace check that passes on
 * everything reads exactly like one that was never needed.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { checkTokens, customProperties, dataAttributes, formatFailures } from './check-tokens'

const roots: string[] = []
let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'rxova-check-tokens-'))
  roots.push(root)
})
afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
})

const write = (path: string, body: string): void => {
  const full = join(root, path)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, body)
}

/** A component package that declares itself, with one source file. */
function componentPackage(source: string, slug = 'otp'): void {
  write(
    'packages/react-otp-input/package.json',
    JSON.stringify({ name: '@rxova/react-otp-input', rxova: { slug, label: 'OTP' } }),
  )
  write('packages/react-otp-input/src/OtpInput.tsx', source)
}

const reasons = () => checkTokens(root).map((f) => f.reason)

describe('customProperties', () => {
  it('finds a property inside a var() fallback chain', () => {
    expect(customProperties("outline: 'var(--rx-otp-ring, 2px solid Highlight)'")).toEqual([
      '--rx-otp-ring',
    ])
  })

  it('reads only what a component consumes, not every -- in the text', () => {
    expect(customProperties('// tuned by --rx-otp-gap\nconst next = count--')).toEqual([])
  })
})

describe('dataAttributes', () => {
  it('finds the JSX attribute, the object key and the selector forms', () => {
    const source = [
      '<span data-rx-otp-slot="" />',
      "getRootProps: () => ({ 'data-rx-otp-root': '' })",
      "container.querySelector('[data-rx-otp-caret]')",
    ].join('\n')

    expect([...new Set(dataAttributes(source))]).toEqual([
      'data-rx-otp-slot',
      'data-rx-otp-root',
      'data-rx-otp-caret',
    ])
  })

  it('ignores prose describing the convention, which is not an attribute', () => {
    expect(dataAttributes('// Every component carries a data-rx-<slug>-root hook.')).toEqual([])
  })
})

describe('checkTokens', () => {
  it('passes a package whose hooks all sit in its own namespace', () => {
    componentPackage(
      [
        "const style = { gap: 'var(--rx-otp-gap, 0.5rem)' }",
        '<span data-rx-otp-slot="" data-invalid="" />',
      ].join('\n'),
    )

    expect(reasons()).toEqual([])
  })

  it('catches a property left on another package’s prefix', () => {
    componentPackage("const style = { gap: 'var(--rphi-gap, 0.5rem)' }")

    expect(reasons()).toEqual([
      'packages/react-otp-input/src/OtpInput.tsx names `--rphi-gap`, which is not `--rx-otp-*`',
    ])
  })

  it('catches an attribute namespaced to the wrong component', () => {
    componentPackage('<span data-rx-password-root="" />')

    expect(reasons()).toEqual([
      'packages/react-otp-input/src/OtpInput.tsx names `data-rx-password-root`, which is neither `data-rx-otp-*` nor a shared state hook',
    ])
  })

  it('allows the shared state hooks, which mean the same thing on every input', () => {
    componentPackage('<span data-invalid="" data-disabled="" data-readonly="" data-focused="" />')

    expect(reasons()).toEqual([])
  })

  it('reports each name once per file rather than once per occurrence', () => {
    componentPackage(
      ['<span data-rx-password-root="" />', '<b data-rx-password-root="" />'].join('\n'),
    )

    expect(reasons()).toHaveLength(1)
  })

  it('skips __tests__, where a fixture legitimately passes arbitrary attributes through', () => {
    componentPackage('<span data-rx-otp-slot="" />')
    write('packages/react-otp-input/src/__tests__/otp.browser.test.tsx', '<Otp data-custom="x" />')

    expect(reasons()).toEqual([])
  })

  it('ignores a package that does not declare itself a component', () => {
    write('packages/utils/package.json', JSON.stringify({ name: '@rxova/utils' }))
    write('packages/utils/src/thing.ts', "const style = { gap: 'var(--nope-gap, 1px)' }")

    expect(reasons()).toEqual([])
  })
})

describe('formatFailures', () => {
  it('counts the problems and names the package on every line', () => {
    const message = formatFailures([{ package: '@rxova/react-otp-input', reason: 'names `--x`' }])

    expect(message).toBe('1 styling-token problem(s):\n  ✗ @rxova/react-otp-input names `--x`')
  })
})
