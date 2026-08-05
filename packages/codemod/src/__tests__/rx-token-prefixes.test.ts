/**
 * This transform never parses — see the header on the transform for why — so
 * the tests assert on text rather than on an AST shape. The two that earn their
 * place are idempotence (a consumer who runs it twice must not get
 * `--rx-rx-otp-gap`) and the untouched-file case, because a transform that
 * reports every file as changed makes `--dry` useless for reviewing a codemod.
 */
import { describe, expect, it } from 'vitest'
import transform from '../transforms/rx-token-prefixes'

const run = (source: string): string | undefined => transform({ source, path: 'test.tsx' })

describe('transform', () => {
  it('renames both packages that shipped the old prefixes', () => {
    expect(run('var(--otp-gap, 4px)')).toBe('var(--rx-otp-gap, 4px)')
    expect(run('[data-rfs-item]')).toBe('[data-rx-rating-item]')
  })

  it('leaves the shared state hooks alone, since those did not move', () => {
    expect(run('[data-invalid] [data-state="full"]')).toBeUndefined()
  })

  it('is idempotent, so running the codemod twice is safe', () => {
    const once = run('--otp-gap')
    expect(once).toBe('--rx-otp-gap')
    expect(run(once ?? '')).toBeUndefined()
  })

  it('rewrites a style-object key and a var() value without touching quote style', () => {
    const out = run(
      `const a = <div style={{ '--otp-gap': '4px', color: 'var(--rfs-size, red)' }} />`,
    )

    expect(out).toBe(
      `const a = <div style={{ '--rx-otp-gap': '4px', color: 'var(--rx-rating-size, red)' }} />`,
    )
  })

  it('rewrites a selector passed to querySelector', () => {
    expect(run(`document.querySelector('[data-otp-root] [data-otp-slot]')`)).toContain(
      '[data-rx-otp-root] [data-rx-otp-slot]',
    )
  })

  it('rewrites a styled-components template', () => {
    const out = run('const S = styled.div`\n  [data-rfs-root] { --rfs-size: 2rem; }\n`')

    expect(out).toContain('[data-rx-rating-root]')
    expect(out).toContain('--rx-rating-size')
  })

  it('rewrites a JSX attribute name', () => {
    expect(run(`const a = <div data-otp-root="" data-invalid="" />`)).toBe(
      `const a = <div data-rx-otp-root="" data-invalid="" />`,
    )
  })

  it('rewrites a plain stylesheet, which is where most of these names live', () => {
    expect(run('[data-otp-slot] {\n  --otp-slot-size: 3rem;\n}')).toBe(
      '[data-rx-otp-slot] {\n  --rx-otp-slot-size: 3rem;\n}',
    )
  })

  it('reports a file naming none of them as unchanged', () => {
    expect(run(`const a = <div style={{ gap: 'var(--app-gap)' }} />`)).toBeUndefined()
  })
})
