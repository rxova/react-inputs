import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { TimezoneInput } from '../TimezoneInput'
import { ZONES, resolveZone, zoneOffsetMinutes } from '../zones'

/**
 * The pass written from the other side of the field: what does someone trying
 * to break this hand it?
 *
 * Every case is a prop or an interaction a real consumer can produce, and the
 * assertion is always the same shape — the field keeps working and keeps telling
 * the truth. This pass found five defects in the measurement input and four
 * here, so it is not decoration.
 */

const quiet = { onWarn: () => undefined }

function select(container: HTMLElement) {
  return container.querySelector<HTMLSelectElement>('[data-rx-timezone-select]')!
}

function values(container: HTMLElement) {
  return [...select(container).options].map((option) => option.value)
}

describe('hostile values', () => {
  it('empties rather than guessing at a value it cannot use', async () => {
    for (const value of [
      'Mars/Olympus',
      'not a zone',
      '',
      'GMT+2',
      'Europe/',
      '../../etc/passwd',
    ]) {
      const { container } = await render(
        <TimezoneInput label="Zone" locale="en-GB" defaultValue={value} {...quiet} />,
      )
      expect(select(container).value).toBe('')
    }
  })

  /**
   * The one the ordering bug hid. `Intl` genuinely accepts `+02:00` as a time
   * zone, so a usable-first check let it through — and an offset is exactly what
   * this field exists to stop anyone storing, because it cannot express DST.
   */
  it('refuses an offset even though Intl accepts it', async () => {
    for (const offset of ['+02:00', '-05:00', '+0200', '+02']) {
      const { container } = await render(
        <TimezoneInput label="Zone" locale="en-GB" defaultValue={offset} {...quiet} />,
      )
      expect(select(container).value).toBe('')
      expect(values(container)).not.toContain(offset)
    }
  })

  it('takes a value that is not a string at all without throwing', async () => {
    for (const value of [5, {}, [], true, Number.NaN] as unknown as string[]) {
      const { container } = await render(
        <TimezoneInput label="Zone" locale="en-GB" defaultValue={value} {...quiet} />,
      )
      expect(select(container).value).toBe('')
    }
  })

  it('keeps an Etc/GMT zone selectable while warning that its sign is backwards', async () => {
    const { container } = await render(
      <TimezoneInput label="Zone" locale="en-GB" defaultValue="Etc/GMT+5" {...quiet} />,
    )
    // It is a real zone, so it is kept — and it really is UTC−5.
    expect(select(container).value).toBe('Etc/GMT+5')
    expect(zoneOffsetMinutes('Etc/GMT+5')).toBe(-300)
  })

  it('never loses a value the engine knows but does not list', async () => {
    const { container } = await render(
      <TimezoneInput label="Zone" locale="en-GB" defaultValue="US/Eastern" {...quiet} />,
    )
    // Canonicalised onto a listed zone rather than dropped.
    expect(select(container).value).toBe(resolveZone('US/Eastern'))
    expect(select(container).value).not.toBe('')
  })

  it('does not let a value smuggle markup into an option', async () => {
    const nasty = '<script>alert(1)</script>'
    const { container } = await render(
      <TimezoneInput label="Zone" locale="en-GB" zones={['UTC']} defaultValue={nasty} {...quiet} />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(select(container).value).toBe('')
  })
})

describe('hostile zone lists', () => {
  it('renders a working field from an array of pure junk', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        zones={['Mars/Olympus', '', null, 7, {}, '__proto__', 'constructor'] as unknown as string[]}
        {...quiet}
      />,
    )
    // Nothing usable was given, so the full list stands in.
    expect(values(container).filter(Boolean).length).toBe(ZONES.length)
  })

  /**
   * `zones={['+02:00']}` used to put an option in the list that the value path
   * would then refuse to hold — pick it and the field would clear itself.
   */
  it('does not offer an option it would refuse as a value', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        zones={['+02:00', '+0200', 'Europe/Madrid']}
        {...quiet}
      />,
    )
    const offered = values(container).filter(Boolean)
    expect(offered).not.toContain('+02:00')
    expect(offered).not.toContain('+0200')
    expect(offered).toContain('Europe/Madrid')
  })

  it('collapses two spellings of one zone into one option', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        zones={['Europe/Kyiv', 'Europe/Kiev']}
        {...quiet}
      />,
    )
    const offered = values(container).filter(Boolean)
    // UTC plus exactly one entry for the place, whichever way this ICU spells it.
    expect(offered).toHaveLength(2)
    expect(new Set(offered).size).toBe(2)
  })

  it('survives a list far longer than the platform has zones', async () => {
    const flood = Array.from({ length: 4000 }, (_, index) => ZONES[index % ZONES.length]!)
    const { container } = await render(
      <TimezoneInput label="Zone" locale="en-GB" zones={flood} {...quiet} />,
    )
    expect(values(container).filter(Boolean)).toHaveLength(ZONES.length)
  })

  it('still offers UTC when the list deliberately omits it', async () => {
    const { container } = await render(
      <TimezoneInput label="Zone" locale="en-GB" zones={['Europe/Madrid']} {...quiet} />,
    )
    expect(values(container)).toContain('UTC')
  })

  /**
   * `zones={[...]}` written inline is a new array every render. Keyed on
   * identity, the list re-sorted on each one — 419 zones, hundreds of `Intl`
   * constructions and tens of milliseconds, for an identical answer.
   */
  it('does not rebuild the list when an inline array is re-created', async () => {
    function Harness() {
      const [, force] = useState(0)
      return (
        <>
          <TimezoneInput
            label="Zone"
            locale="en-GB"
            zones={['Europe/Madrid', 'Asia/Tokyo']}
            defaultValue="Asia/Tokyo"
            {...quiet}
          />
          <button
            type="button"
            onClick={() => {
              force((count) => count + 1)
            }}
          >
            rerender
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    const before = values(container)
    for (let press = 0; press < 5; press++) {
      await userEvent.click(page.getByRole('button', { name: 'rerender' }))
    }
    expect(values(container)).toEqual(before)
    expect(select(container).value).toBe('Asia/Tokyo')
  })
})

describe('hostile reference dates', () => {
  it('falls back to now for an Invalid Date rather than blanking every offset', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        zones={['Europe/Madrid']}
        referenceDate={new Date('2026-13-01')}
        {...quiet}
      />,
    )
    expect(container.textContent).toMatch(/[+-]\d{2}:\d{2}/)
  })

  it('takes something that is not a Date at all', async () => {
    for (const when of [0, '2026-01-01', null, {}] as unknown as Date[]) {
      const { container } = await render(
        <TimezoneInput
          label="Zone"
          locale="en-GB"
          zones={['Europe/Madrid']}
          referenceDate={when}
          {...quiet}
        />,
      )
      expect(container.textContent).toMatch(/[+-]\d{2}:\d{2}/)
    }
  })

  /**
   * Before a zone adopted standard time its offset had seconds in it —
   * `GMT-00:14:44` — which the offset parser did not match, so a reference date
   * in the 1800s silently blanked every offset in the list.
   */
  it('handles an instant so early that offsets carry seconds', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        zones={['Europe/Madrid']}
        referenceDate={new Date(Date.UTC(1850, 0, 1))}
        {...quiet}
      />,
    )
    expect(container.textContent).toMatch(/[+-]\d{2}:\d{2}/)
  })

  it('takes the extremes of the Date range', async () => {
    for (const stamp of [0, 8640000000000000, -8640000000000000]) {
      const { container } = await render(
        <TimezoneInput
          label="Zone"
          locale="en-GB"
          zones={['Europe/Madrid']}
          referenceDate={new Date(stamp)}
          {...quiet}
        />,
      )
      expect(select(container).options.length).toBeGreaterThan(1)
    }
  })
})

describe('hostile callbacks and locales', () => {
  it('survives a renderZone that throws', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        zones={['Europe/Madrid']}
        renderZone={() => {
          throw new Error('consumer bug')
        }}
        {...quiet}
      />,
    )
    const madrid = [...select(container).options].find((o) => o.value === 'Europe/Madrid')
    expect(madrid?.textContent).toMatch(/^Madrid/)
  })

  it('survives a renderZone that returns nothing visible', async () => {
    for (const value of ['', undefined, null, 5] as unknown as string[]) {
      const { container } = await render(
        <TimezoneInput
          label="Zone"
          locale="en-GB"
          zones={['Europe/Madrid']}
          renderZone={() => value}
          {...quiet}
        />,
      )
      // An <option> with no text is an invisible, unselectable row.
      const madrid = [...select(container).options].find((o) => o.value === 'Europe/Madrid')
      expect(madrid?.textContent?.trim()).not.toBe('')
    }
  })

  it('uses a renderZone that works', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        zones={['Europe/Madrid']}
        renderZone={(state) => `${state.city} ${state.offset ?? ''}`}
        {...quiet}
      />,
    )
    const madrid = [...select(container).options].find((o) => o.value === 'Europe/Madrid')
    expect(madrid?.textContent).toMatch(/^Madrid [+-]\d{2}:\d{2}$/)
  })

  it('takes an explicitly null controlled value', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TimezoneInput label="Zone" locale="en-GB" value={null} onChange={onChange} {...quiet} />,
    )
    expect(select(container).value).toBe('')
    await userEvent.selectOptions(select(container), 'UTC')
    expect(onChange).toHaveBeenLastCalledWith('UTC')
    // Still controlled, and the parent did not accept.
    expect(select(container).value).toBe('')
  })

  it('reports the same problem once however often the effect re-runs', async () => {
    // `onWarn` identity is a dependency, so a parent that passes an inline
    // arrow re-runs the diagnostics on every render. It must not re-report.
    const seen: string[] = []
    function Harness() {
      const [count, force] = useState(0)
      return (
        <>
          <TimezoneInput
            label="Zone"
            locale="en-GB"
            defaultValue="Mars/Olympus"
            onWarn={(warning) => {
              seen.push(`${warning.code}:${String(count)}`)
            }}
          />
          <button
            type="button"
            onClick={() => {
              force((n) => n + 1)
            }}
          >
            rerender
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    void container
    await userEvent.click(page.getByRole('button', { name: 'rerender' }))
    await userEvent.click(page.getByRole('button', { name: 'rerender' }))
    expect(seen).toHaveLength(1)
  })

  it('falls back to the runtime locale rather than blanking on a bad tag', async () => {
    const { container } = await render(
      <TimezoneInput label="Zone" locale="en_US" zones={['Europe/Madrid']} {...quiet} />,
    )
    const madrid = [...select(container).options].find((o) => o.value === 'Europe/Madrid')
    expect(madrid?.textContent?.trim()).not.toBe('')
  })

  /**
   * The deliberate non-fix: `onChange` is the consumer's state setter, and
   * swallowing its exception would leave the parent holding a value the field no
   * longer shows, with the error that explains it gone.
   */
  it('does not swallow an onChange that throws, and still shows the selection', async () => {
    const escaped: string[] = []
    const trap = (event: ErrorEvent) => {
      escaped.push(event.message)
      event.preventDefault()
    }
    window.addEventListener('error', trap)
    try {
      const { container } = await render(
        <TimezoneInput
          label="Zone"
          locale="en-GB"
          zones={['Europe/Madrid', 'Asia/Tokyo']}
          onChange={() => {
            throw new Error('consumer bug')
          }}
          {...quiet}
        />,
      )
      await userEvent.selectOptions(select(container), 'Asia/Tokyo')
      expect(select(container).value).toBe('Asia/Tokyo')
      expect(escaped.some((message) => message.includes('consumer bug'))).toBe(true)
    } finally {
      window.removeEventListener('error', trap)
    }
  })
})

describe('hostile control flow', () => {
  /**
   * A controlled parent that rejects every change. The select must snap back to
   * what the parent holds rather than drifting away from it — a native select
   * happily keeps a selection React did not sanction.
   */
  it('snaps back when a controlled parent refuses the change', async () => {
    const { container } = await render(
      <TimezoneInput
        label="Zone"
        locale="en-GB"
        value="Europe/Madrid"
        onChange={() => undefined}
        {...quiet}
      />,
    )
    await userEvent.selectOptions(select(container), 'Asia/Tokyo')
    expect(select(container).value).toBe('Europe/Madrid')
  })

  /**
   * The defect this pass found, and the worst of the four. A native `<select>`
   * whose `value` matches no option paints its *first* one instead — so with
   * nothing selected the field showed UTC, and a form would have posted UTC
   * while `onChange` had never fired. `allowEmpty={false}` is the loudest way to
   * ask for that, and even then the empty option has to win.
   */
  it('never paints a zone it has not got, even when asked to suppress the empty option', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <form>
        <TimezoneInput
          label="Zone"
          locale="en-GB"
          name="zone"
          allowEmpty={false}
          onChange={onChange}
          {...quiet}
        />
      </form>,
    )
    const root = container.querySelector('[data-rx-timezone-root]')!
    expect(select(container).value).toBe('')
    expect(root.hasAttribute('data-complete')).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    // And the form agrees with the model rather than with the first option.
    expect(new FormData(container.querySelector('form')!).get('zone')).toBe('')
  })

  it('paints nothing rather than the first zone when the value is unusable', async () => {
    const { container } = await render(
      <form>
        <TimezoneInput
          label="Zone"
          locale="en-GB"
          name="zone"
          defaultValue="Mars/Olympus"
          {...quiet}
        />
      </form>,
    )
    expect(select(container).value).toBe('')
    expect(new FormData(container.querySelector('form')!).get('zone')).toBe('')
  })

  it('keeps working when the zone list shrinks out from under the value', async () => {
    function Harness() {
      const [narrow, setNarrow] = useState(false)
      return (
        <>
          <TimezoneInput
            label="Zone"
            locale="en-GB"
            zones={narrow ? ['Europe/Madrid'] : ['Europe/Madrid', 'Asia/Tokyo']}
            value="Asia/Tokyo"
            onChange={() => undefined}
            {...quiet}
          />
          <button
            type="button"
            onClick={() => {
              setNarrow(true)
            }}
          >
            narrow
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    expect(select(container).value).toBe('Asia/Tokyo')
    await userEvent.click(page.getByRole('button', { name: 'narrow' }))
    // The value is still held, so it stays on offer rather than vanishing.
    expect(values(container)).toContain('Asia/Tokyo')
    expect(select(container).value).toBe('Asia/Tokyo')
  })

  it('survives being toggled between grouped and flat while holding a value', async () => {
    function Harness() {
      const [grouped, setGrouped] = useState(true)
      return (
        <>
          <TimezoneInput
            label="Zone"
            locale="en-GB"
            grouped={grouped}
            defaultValue="Asia/Tokyo"
            {...quiet}
          />
          <button
            type="button"
            onClick={() => {
              setGrouped((on) => !on)
            }}
          >
            toggle
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(page.getByRole('button', { name: 'toggle' }))
    expect(container.querySelectorAll('optgroup')).toHaveLength(0)
    expect(select(container).value).toBe('Asia/Tokyo')
    await userEvent.click(page.getByRole('button', { name: 'toggle' }))
    expect(container.querySelectorAll('optgroup').length).toBeGreaterThan(1)
    expect(select(container).value).toBe('Asia/Tokyo')
  })
})
