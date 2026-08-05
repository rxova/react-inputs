/**
 * The property worth testing is that both renames happen in **one** pass. Done
 * sequentially — `onValueChange` → `onChange`, then `onChange` → `onNativeChange`
 * — the value handler walks through both steps and lands on the native prop,
 * silently swapping the two. That is the mistake this transform exists to
 * prevent, so it is the case asserted first.
 */
import { describe, expect, it } from 'vitest'
import { applyTransform } from 'jscodeshift/dist/testUtils'
import transform from '../transforms/currency-on-change'

function run(source: string): string {
  return applyTransform(transform, {}, { source, path: 'test.tsx' }, { parser: 'tsx' })
}

const IMPORT = `import { CurrencyInput } from '@rxova/react-intl-currency-input'\n`

describe('currency-on-change', () => {
  it('renames both handlers without walking one into the other', () => {
    const out = run(
      `${IMPORT}const a = <CurrencyInput onValueChange={setPrice} onChange={logEvent} />`,
    )

    expect(out).toContain('onChange={setPrice}')
    expect(out).toContain('onNativeChange={logEvent}')
    expect(out).not.toContain('onValueChange')
  })

  it('renames the value handler when it is the only one', () => {
    const out = run(`${IMPORT}const a = <CurrencyInput onValueChange={setPrice} />`)

    expect(out).toContain('onChange={setPrice}')
    expect(out).not.toContain('onNativeChange')
  })

  it('follows an alias rather than matching on the name it was published under', () => {
    const out = run(
      `import { CurrencyInput as Money } from '@rxova/react-intl-currency-input'\n` +
        `const a = <Money onValueChange={setPrice} />`,
    )

    expect(out).toContain('onChange={setPrice}')
  })

  it('rewrites the hook options too, which took the same rename', () => {
    const out = run(
      `import { useCurrencyInput } from '@rxova/react-intl-currency-input'\n` +
        `const f = useCurrencyInput({ currency: 'EUR', onValueChange: setPrice })`,
    )

    expect(out).toContain('onChange: setPrice')
  })

  it('leaves a same-named component from somewhere else alone', () => {
    // The rename is only correct for this package. A `<CurrencyInput>` from
    // another library keeps whatever `onChange` means there.
    expect(
      run(
        `import { CurrencyInput } from 'some-other-lib'\nconst a = <CurrencyInput onChange={f} />`,
      ),
    ).toBe('')
  })

  it('leaves a file with neither handler untouched', () => {
    expect(run(`${IMPORT}const a = <CurrencyInput currency="EUR" />`)).toBe('')
  })
})
