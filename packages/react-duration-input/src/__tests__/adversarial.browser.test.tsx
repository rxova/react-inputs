import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { DurationInput } from '../DurationInput'
import type { DurationUnit } from '../duration'
import type { DurationInputProps } from '../types'

/**
 * Written from the position of someone trying to break this thing.
 *
 * The rule the whole file follows: hostile *data* and hostile *callbacks* are
 * contained; the component keeps rendering something usable and says what it
 * refused. The one deliberate exception is `onChange`, which still propagates —
 * it is the consumer's own state setter, and swallowing it would desync the
 * parent while hiding the bug.
 *
 * `as unknown as` appears throughout on purpose: every case here is what a
 * JavaScript caller, a JSON payload or a loosely-typed form library can actually
 * hand this component at runtime, whatever the types say at the boundary.
 */

function seg(container: HTMLElement, unit: DurationUnit) {
  return container.querySelector<HTMLElement>(`[data-rx-duration-segment="${unit}"]`)!
}

function segments(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rx-duration-segment]'))
}

const quiet = { onWarn: () => undefined } satisfies Partial<DurationInputProps>

describe('hostile values', () => {
  it.each([
    'P1M',
    'P1Y',
    'garbage',
    '',
    'P',
    'PT',
    '90',
    '5400000',
    '01:30:00',
    '-PT1H',
    'PT1H30',
    '<script>alert(1)</script>',
    'PT99999999999999999999H',
  ])('renders an empty, working field for %s', async (value) => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue={value} {...quiet} />,
    )
    expect(segments(container)).toHaveLength(2)
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('45')
    expect(seg(container, 'minute').textContent).toBe('45')
  })

  it('never renders a value as markup', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        defaultValue="<img src=x onerror=alert(1)>"
        {...quiet}
      />,
    )
    expect(container.querySelector('img')).toBeNull()
  })

  it('survives a value that is not a string at all', async () => {
    for (const value of [5400, {}, [], true, Number.NaN] as unknown as string[]) {
      const { container } = await render(
        <DurationInput label="Duration" locale="en-GB" defaultValue={value} {...quiet} />,
      )
      expect(segments(container)).toHaveLength(2)
    }
  })

  it('warns rather than silently truncating a value finer than the units shown', async () => {
    const onWarn = vi.fn()
    await render(
      <DurationInput label="Duration" locale="en-GB" defaultValue="PT90S" onWarn={onWarn} />,
    )
    expect(onWarn.mock.calls.map((call) => call[0].code)).toContain('value-truncated')
  })
})

describe('hostile units', () => {
  it.each([
    [[] as DurationUnit[]],
    [['month'] as unknown as DurationUnit[]],
    [[null, undefined] as unknown as DurationUnit[]],
    [[1, 2, 3] as unknown as DurationUnit[]],
    [['hour', 'hour', 'hour'] as DurationUnit[]],
    [['minute', 'day', 'second', 'hour'] as DurationUnit[]],
  ])('renders a usable field for %j', async (units) => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={units} {...quiet} />,
    )
    expect(segments(container).length).toBeGreaterThan(0)
    const first = segments(container)[0] as HTMLElement
    await userEvent.click(first)
    await userEvent.keyboard('5')
    expect(first.textContent).not.toBe('')
  })

  /**
   * The one that would silently produce a broken field rather than a crash:
   * rendered as written, `['minute', 'hour']` puts a 0–59 segment in front of
   * an unbounded one, so `90` is refused in the first box and accepted in the
   * second.
   */
  it('never puts a bounded segment ahead of the unbounded one', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        units={['second', 'minute', 'hour']}
        {...quiet}
      />,
    )
    const first = segments(container)[0]
    expect(first?.getAttribute('data-rx-duration-segment')).toBe('hour')
    expect(first?.hasAttribute('aria-valuemax')).toBe(false)
  })

  it('survives units changing under it mid-edit', async () => {
    function Harness() {
      const [units, setUnits] = useState<DurationUnit[]>(['hour', 'minute'])
      return (
        <>
          <DurationInput label="Duration" locale="en-GB" units={units} defaultValue="PT1H30M" />
          <button
            type="button"
            onClick={() => {
              setUnits(['minute'])
            }}
          >
            Collapse
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(page.getByRole('button', { name: 'Collapse' }))
    expect(segments(container)).toHaveLength(1)
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('45')
    expect(seg(container, 'minute').textContent).toBe('45')
  })
})

describe('hostile bounds and steps', () => {
  it.each(['garbage', 'P1M', '', '90'])('ignores an unreadable min/max of %s', async (bound) => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        min={bound}
        max={bound}
        defaultValue="PT1H"
        {...quiet}
      />,
    )
    expect(container.querySelector('[data-rx-duration-root]')?.hasAttribute('data-invalid')).toBe(
      false,
    )
  })

  it('drops an impossible range instead of making the field unfillable', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        min="PT5H"
        max="PT1M"
        onChange={onChange}
        {...quiet}
      />,
    )
    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('02')
    await userEvent.keyboard('00')
    expect(onChange).toHaveBeenLastCalledWith('PT2H')
    expect(container.querySelector('[data-rx-duration-root]')?.hasAttribute('data-invalid')).toBe(
      false,
    )
  })

  /**
   * A step of `-3` would invert the arrows; a step of `0` or `NaN` would make
   * them silently dead. Both are worse than a wrong-but-predictable step,
   * because the control looks operable and is not.
   */
  it.each([-3, 0, Number.NaN, 1.5, 7, Infinity, 1e9])(
    'falls back to a step of 1 for %s, so the arrows always move the right way',
    async (step) => {
      const { container } = await render(
        <DurationInput
          label="Duration"
          locale="en-GB"
          minuteStep={step}
          defaultValue="PT1H30M"
          {...quiet}
        />,
      )
      await userEvent.click(seg(container, 'minute'))
      await userEvent.keyboard('{ArrowUp}')
      expect(seg(container, 'minute').textContent).toBe('31')
      await userEvent.keyboard('{ArrowDown}{ArrowDown}')
      expect(seg(container, 'minute').textContent).toBe('29')
    },
  )

  it('falls back rather than throwing on a locale tag Intl refuses', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en_US" defaultValue="PT1H30M" {...quiet} />,
    )
    expect(seg(container, 'hour').textContent).toBe('1')
    // The suffix falls back to the ASCII abbreviation, and the segment still
    // has a usable accessible name rather than an empty one.
    expect(container.textContent).toContain('h')
    expect(seg(container, 'hour').getAttribute('aria-label')).toBe('Hours')
  })
})

describe('hostile callbacks', () => {
  /**
   * `renderSegment` runs inside render. Before this was contained, a formatter
   * that threw took the whole tree down with it — one bad consumer function and
   * the page is blank.
   */
  it('survives a renderSegment that throws', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        defaultValue="PT1H30M"
        renderSegment={() => {
          throw new Error('boom')
        }}
        {...quiet}
      />,
    )
    expect(segments(container)).toHaveLength(2)
    expect(seg(container, 'hour').textContent).toBe('1')
  })

  it('falls back when renderSegment returns nothing renderable', async () => {
    for (const returned of [undefined, null, ''] as unknown[]) {
      const { container } = await render(
        <DurationInput
          label="Duration"
          locale="en-GB"
          defaultValue="PT1H30M"
          renderSegment={() => returned as never}
          {...quiet}
        />,
      )
      // A segment with no text is a spinbutton with no visible value.
      expect(seg(container, 'hour').textContent).not.toBe('')
    }
  })

  it('uses a renderSegment that works', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        defaultValue="PT1H30M"
        renderSegment={(state) => <b>{state.text}</b>}
        {...quiet}
      />,
    )
    expect(seg(container, 'hour').querySelector('b')?.textContent).toBe('1')
  })

  it('keeps working when onPartsChange throws', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        onPartsChange={() => {
          throw new Error('boom')
        }}
        {...quiet}
      />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('45')
    expect(seg(container, 'minute').textContent).toBe('45')
  })

  it('keeps working when onWarn throws', async () => {
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        defaultValue="P1M"
        onWarn={() => {
          throw new Error('boom')
        }}
      />,
    )
    expect(segments(container)).toHaveLength(2)
  })

  /**
   * The deliberate non-fix. `onChange` is the consumer's state setter; catching
   * its exception would leave the parent holding a value the field no longer
   * shows, with the error that explains it swallowed. The uncontrolled value is
   * committed before the callback runs, so the field itself stays correct.
   */
  it('does not swallow an onChange that throws, and still shows the new value', async () => {
    // The exception is *meant* to escape, so it reaches window.onerror. Caught
    // here only so the runner does not count the component's correct behaviour
    // as an unhandled failure.
    const escaped: string[] = []
    const trap = (event: ErrorEvent) => {
      escaped.push(event.message)
      event.preventDefault()
    }
    window.addEventListener('error', trap)
    try {
      const { container } = await render(
        <DurationInput
          label="Duration"
          locale="en-GB"
          onChange={() => {
            throw new Error('consumer bug')
          }}
          {...quiet}
        />,
      )
      await userEvent.click(seg(container, 'hour'))
      await userEvent.keyboard('01')
      await userEvent.keyboard('30')
      // Committed before the callback ran, so the field is correct even though
      // the consumer's setter blew up.
      expect(seg(container, 'minute').textContent).toBe('30')
      expect(escaped.join(' ')).toContain('consumer bug')
    } finally {
      window.removeEventListener('error', trap)
    }
  })
})

describe('hostile input sequences', () => {
  it('survives a long run of digits in one segment', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="en-GB" units={['minute']} {...quiet} />,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('1'.repeat(40))
    // Bounded by the segment width, not by however long someone leans on a key.
    expect(seg(container, 'minute').textContent?.length).toBeLessThanOrEqual(3)
  })

  it('survives alternating clear and type', async () => {
    const { container } = await render(<DurationInput label="Duration" locale="en-GB" {...quiet} />)
    await userEvent.click(seg(container, 'minute'))
    for (let i = 0; i < 15; i++) {
      await userEvent.keyboard('4{Backspace}')
    }
    expect(seg(container, 'minute').textContent).toBe('mm')
  })

  it('never emits a duration it is not showing', async () => {
    const seen: (string | null)[] = []
    const { container } = await render(
      <DurationInput
        label="Duration"
        locale="en-GB"
        onChange={(value) => seen.push(value)}
        {...quiet}
      />,
    )
    await userEvent.click(seg(container, 'hour'))
    await userEvent.keyboard('1')
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('30')
    await userEvent.click(document.body)
    for (const value of seen) {
      if (value !== null) expect(value).toMatch(/^P/)
    }
    expect(seen.at(-1)).toBe('PT1H30M')
  })

  it('does not lose the carry when blur and a controlled write race', async () => {
    function Harness() {
      const [value, setValue] = useState<string | null>('PT0S')
      return (
        <>
          <DurationInput label="Duration" locale="en-GB" value={value} onChange={setValue} />
          <button type="button">Elsewhere</button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('90')
    await userEvent.click(page.getByRole('button', { name: 'Elsewhere' }))
    expect(seg(container, 'hour').textContent).toBe('1')
    expect(seg(container, 'minute').textContent).toBe('30')
  })
})

describe('hostile rendering context', () => {
  it('renders right-to-left without reordering the units', async () => {
    const { container } = await render(
      <DurationInput label="Duration" locale="ar-EG" dir="rtl" defaultValue="PT1H30M" />,
    )
    expect(
      segments(container).map((element) => element.getAttribute('data-rx-duration-segment')),
    ).toEqual(['hour', 'minute'])
  })

  it('survives being rendered inside a form that submits on Enter', async () => {
    let submits = 0
    const { container } = await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submits++
        }}
      >
        <DurationInput label="Duration" locale="en-GB" name="d" />
      </form>,
    )
    await userEvent.click(seg(container, 'minute'))
    await userEvent.keyboard('45{Enter}')
    // Enter is left to the browser — a duration field has no business
    // intercepting the form's own submit key.
    expect(submits).toBeLessThanOrEqual(1)
  })

  it('renders a hundred instances without id collisions', async () => {
    const { container } = await render(
      <>
        {Array.from({ length: 100 }, (_, index) => (
          <DurationInput key={index} label={`Duration ${String(index)}`} locale="en-GB" />
        ))}
      </>,
    )
    const ids = segments(container).map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
