import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { PhoneInput } from '../PhoneInput'
import { COUNTRIES, countryByISO2 } from '../countries'
import { digitsOnly, formatPhone, isPossible, parsePhone } from '../phone'

/**
 * Adversarial suite.
 *
 * Not "does the happy path work" — the other files cover that. Each of these is
 * an attempt to break the component: hostile props, hostile input, and the
 * invariants the README claims. Several found real defects on first run; the
 * comments say which.
 */
function input(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rphi-input]')!
}

function select(container: HTMLElement) {
  return container.querySelector<HTMLSelectElement>('[data-rphi-country]')!
}

describe('hostile props', () => {
  it('falls back rather than rendering an empty picker for an empty country list', async () => {
    // A picker with nothing in it is not a usable field, so the prop is ignored.
    const onWarn = vi.fn()
    const { container } = await render(<PhoneInput label="Phone" countries={[]} onWarn={onWarn} />)
    expect(select(container).options.length).toBeGreaterThan(200)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'empty-country-list' }))
  })

  it('drops unknown codes from a country list instead of rendering blanks', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <PhoneInput
        label="Phone"
        countries={['GB', 'ZZ', 'FR']}
        defaultCountry="GB"
        onWarn={onWarn}
      />,
    )
    expect(Array.from(select(container).options).map((option) => option.value)).toEqual([
      'GB',
      'FR',
    ])
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'unknown-country' }))
  })

  it('falls back to the full list when every supplied code is unknown', async () => {
    const { container } = await render(
      <PhoneInput label="Phone" countries={['ZZ', 'QQ']} onWarn={() => undefined} />,
    )
    expect(select(container).options.length).toBeGreaterThan(200)
  })

  it('survives a country name or calling code passed where an ISO code belongs', async () => {
    // The most likely mistake, and the message says exactly what was expected.
    const onWarn = vi.fn()
    await render(<PhoneInput label="Phone" defaultCountry="United Kingdom" onWarn={onWarn} />)
    const warning = onWarn.mock.calls
      .map(([w]) => w)
      .find((w) => w.code === 'unknown-default-country')
    expect(warning).toBeDefined()
    expect(String(warning.message)).toContain('ISO 3166-1')
  })

  it('reports a value that is not E.164 rather than silently misreading it', async () => {
    const onWarn = vi.fn()
    await render(
      <PhoneInput label="Phone" defaultCountry="GB" defaultValue="020 7123 4567" onWarn={onWarn} />,
    )
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'value-not-e164' }))
  })

  it('reports a value whose calling code is unknown', async () => {
    const onWarn = vi.fn()
    await render(<PhoneInput label="Phone" defaultValue="+9912345678" onWarn={onWarn} />)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'value-country-unknown' }))
  })

  it('survives a malformed locale tag rather than crashing on RangeError', async () => {
    // `Intl.DisplayNames` throws on "en_US". A country list that crashes over
    // an underscore is worse than one showing ISO codes.
    const onWarn = vi.fn()
    const { container } = await render(
      <PhoneInput
        label="Phone"
        countries={['DE']}
        defaultCountry="DE"
        locale="en_US"
        onWarn={onWarn}
      />,
    )
    expect(select(container).options[0]?.textContent).toContain('DE')
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'locale-invalid' }))
  })
})

describe('hostile input', () => {
  it('never reports a value that is not E.164', async () => {
    // Whatever is typed, `onChange` gets either '' or a string matching E.164.
    const seen: string[] = []
    const { container } = await render(
      <PhoneInput
        label="Phone"
        defaultCountry="US"
        onChange={(value) => {
          seen.push(value)
        }}
      />,
    )
    for (const text of [
      'abc',
      '+++',
      '4155552671',
      '+44(0)20 7123 4567',
      '00 33 6 12 34 56 78',
      '0',
    ]) {
      await userEvent.fill(input(container), text)
    }
    for (const value of seen) {
      if (value === '') continue
      expect(value).toMatch(/^\+\d{1,15}$/)
    }
  })

  it('accepts a paste of pure letters without breaking', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    await userEvent.fill(input(container), 'not a phone number')
    expect(input(container).value).toBe('')
  })

  it('handles an absurdly long paste in linear time', async () => {
    // Someone pastes a file. Every stage has to stay linear, or the tab hangs.
    //
    // Measured as a ratio, not against a millisecond budget: this suite runs
    // beside every other package's browser tests, and a loaded machine misses
    // a fixed target while the code under test is perfectly linear. The shape
    // of the curve is the actual claim — quadratic work grows ~16x for a 4x
    // input, linear stays near 4x. The bar sits at 10 rather than at 5: under a
    // loaded machine the ratio of two short measurements drifts well past the
    // ideal 4, and the claim worth defending is "not quadratic", which would
    // land near 16x.
    //
    // Fastest of several runs, because scheduler noise only ever adds time.
    const fastest = (run: () => void, repeats = 9): number => {
      let best = Infinity
      for (let index = 0; index < repeats; index += 1) {
        const started = performance.now()
        run()
        best = Math.min(best, performance.now() - started)
      }
      return best
    }

    const process = (digits: string) => () => {
      formatPhone(parsePhone(digits, 'US'), false)
    }
    const growth = fastest(process('9'.repeat(50_000))) / fastest(process('9'.repeat(12_500)))

    expect(growth).toBeLessThan(10)
    // And it is emphatically not a possible number.
    expect(parsePhone('9'.repeat(50_000), 'US').possible).toBe(false)
  })

  it('does not let a lone plus produce a bogus value', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" onChange={onChange} />,
    )
    await userEvent.fill(input(container), '+')
    expect(onChange).toHaveBeenLastCalledWith('', expect.objectContaining({ possible: false }))
  })

  it('keeps the calling code visible when the number is deleted back to it', async () => {
    // If `+44` vanished the moment the last national digit went, there would be
    // no way to correct a mistyped calling code.
    const { container } = await render(<PhoneInput label="Phone" defaultValue="+442071234567" />)
    await userEvent.fill(input(container), '+44')
    expect(input(container).value).toBe('+44')
  })

  it('normalises non-Latin numerals typed from a localised keyboard', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <PhoneInput label="Phone" defaultCountry="US" onChange={onChange} />,
    )
    await userEvent.fill(input(container), '٤١٥٥٥٥٢٦٧١')
    expect(onChange).toHaveBeenLastCalledWith('+14155552671', expect.anything())
  })
})

describe('invariants', () => {
  it('reports possible only for lengths the country actually uses', async () => {
    // The claim the README makes is *possibility*, and it must hold for every
    // country in the table, not just the ones with tests.
    for (const country of COUNTRIES) {
      if (country.lengths.length === 0) continue
      for (const length of country.lengths) {
        expect(isPossible(country, '9'.repeat(length))).toBe(true)
      }
      expect(isPossible(country, '9'.repeat(Math.min(...country.lengths) - 1))).toBe(false)
    }
  })

  it('never claims an unknown calling code is possible', async () => {
    // The `+` says the user meant this to be international, so the generic
    // 4–15 bounds must not rescue a code nobody uses.
    expect(parsePhone('+99123456789').possible).toBe(false)
    expect(parsePhone('+00000').possible).toBe(false)
  })

  it('round-trips every country through parse and format', async () => {
    for (const country of COUNTRIES) {
      const national = '9'.repeat(country.lengths[0] ?? 8)
      const e164 = `+${country.dial}${national}`
      const parsed = parsePhone(e164)
      // The calling code must be consumed exactly, leaving the national part.
      expect(parsed.e164).toBe(e164)
      // And the formatted text must contain every digit, in order.
      expect(digitsOnly(formatPhone(parsed, true))).toBe(`${country.dial}${national}`)
    }
  })

  it('keeps the visible text and the posted value in agreement', async () => {
    const { container } = await render(
      <PhoneInput label="Phone" name="phone" defaultCountry="GB" />,
    )
    await userEvent.fill(input(container), '02071234567')
    const hidden = container.querySelector<HTMLInputElement>('[data-rphi-value]')!
    // The box shows grouped national digits, the form posts E.164 — but they
    // must describe the same number, or the user submits something else.
    expect(hidden.value).toBe('+442071234567')
    expect(digitsOnly(input(container).value)).toBe('2071234567')
  })

  it('never lets the select and the text disagree about the country', async () => {
    const { container } = await render(<PhoneInput label="Phone" defaultCountry="US" />)
    for (const [text, iso2] of [
      ['+442071234567', 'GB'],
      ['+33612345678', 'FR'],
      ['+14155552671', 'US'],
    ]) {
      await userEvent.fill(input(container), text!)
      expect(select(container).value).toBe(iso2)
    }
  })

  it('does not leak state between two fields on the same page', async () => {
    const { container } = await render(
      <>
        <PhoneInput label="Home" defaultCountry="GB" defaultValue="+442071234567" />
        <PhoneInput label="Work" defaultCountry="US" defaultValue="+14155552671" />
      </>,
    )
    const boxes = container.querySelectorAll<HTMLInputElement>('[data-rphi-input]')
    expect(boxes[0]!.value).toContain('+44')
    expect(boxes[1]!.value).toContain('+1')

    await userEvent.fill(boxes[0]!, '+33612345678')
    expect(boxes[1]!.value).toContain('+1')

    // And their ids do not collide, or the labels would cross-wire.
    const ids = Array.from(container.querySelectorAll('[id]')).map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('resolves a shared calling code consistently rather than at random', async () => {
    // +1 covers 25 entries. Whatever the answer is, it must be the same every
    // time, or the same input produces different countries across renders.
    expect(countryByISO2('US')?.dial).toBe(countryByISO2('CA')?.dial)
    for (let attempt = 0; attempt < 5; attempt++) {
      expect(parsePhone('+14155552671').country?.iso2).toBe('US')
    }
  })
})
