import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useRef, useState } from 'react'
import { OtpInput } from '../OtpInput'
import { OtpGroup } from '../OtpGroup'
import { OtpSlot } from '../OtpSlot'
import { OtpSeparator } from '../OtpSeparator'

/** The one real field. */
function input(): HTMLInputElement {
  return page.getByRole('textbox').element() as HTMLInputElement
}

/** Visible characters, read from the painted slots — what the user actually sees. */
function slotChars(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-rx-otp-slot]')].map((el) => el.textContent ?? '')
}

/** Dispatch a real paste carrying `text`, exercising the onPaste path (not just an input event). */
function firePaste(el: HTMLInputElement, text: string): void {
  const data = new DataTransfer()
  data.setData('text', text)
  el.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
  )
}

/** Controlled wrapper so onChange actually round-trips to the value prop. */
function Controlled(props: Partial<React.ComponentProps<typeof OtpInput>> = {}) {
  const [value, setValue] = useState('')
  return <OtpInput label="Code" value={value} onChange={setValue} {...props} />
}

describe('rendering', () => {
  it('renders one textbox and `length` decorative slots', async () => {
    const { container } = await render(<OtpInput length={6} label="Code" />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-rx-otp-slot]')).toHaveLength(6)
    // Exactly one accessible field — never "1 of 6" repeated.
    expect(page.getByRole('textbox').elements()).toHaveLength(1)
  })

  it('honours a custom length', async () => {
    const { container } = await render(<OtpInput length={4} label="Code" />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-rx-otp-slot]')).toHaveLength(4)
  })
})

describe('typing', () => {
  it('distributes typed characters across slots', async () => {
    const { container } = await render(<Controlled length={6} />)
    await input().focus()
    await userEvent.keyboard('123')
    expect(slotChars(container).slice(0, 3)).toEqual(['1', '2', '3'])
    expect(input().value).toBe('123')
  })

  it('rejects characters the mode disallows', async () => {
    const { container } = await render(<Controlled length={6} mode="numeric" />)
    await input().focus()
    await userEvent.keyboard('1a2b3')
    expect(input().value).toBe('123')
    expect(slotChars(container).slice(0, 3)).toEqual(['1', '2', '3'])
  })

  it('stops at the slot count', async () => {
    await render(<Controlled length={4} />)
    await input().focus()
    await userEvent.keyboard('1234567')
    expect(input().value).toBe('1234')
  })

  it('uppercases via transform for alphanumeric codes', async () => {
    await render(<Controlled length={4} mode="alphanumeric" transform={(s) => s.toUpperCase()} />)
    await input().focus()
    await userEvent.keyboard('ab12')
    expect(input().value).toBe('AB12')
  })
})

describe('typing over a full code', () => {
  it('arrowing back into a full code selects the slot and typing overwrites it', async () => {
    const { container } = await render(<Controlled length={6} />)
    const el = input()
    await el.focus()
    await userEvent.keyboard('123456')
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    // The caret expanded into a one-character selection over the fourth slot.
    expect([el.selectionStart, el.selectionEnd]).toEqual([3, 4])
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-rx-otp-slot]')[3]?.hasAttribute('data-active')).toBe(
        true,
      )
    })
    // Each keystroke replaces a character and hands the selection to the next
    // slot, so a full code can be retyped straight through from the middle.
    await userEvent.keyboard('987')
    expect(input().value).toBe('123987')
    expect(slotChars(container)).toEqual(['1', '2', '3', '9', '8', '7'])
  })

  it('still ignores overflow typing at the end of a full code', async () => {
    await render(<Controlled length={4} />)
    await input().focus()
    await userEvent.keyboard('12345')
    expect(input().value).toBe('1234')
  })

  it('drops a disallowed key over a full code instead of eating the digit', async () => {
    await render(<Controlled length={6} />)
    await input().focus()
    await userEvent.keyboard('123456')
    await userEvent.keyboard('{ArrowLeft}')
    await userEvent.keyboard('a')
    expect(input().value).toBe('123456')
  })
})

describe('keyboard refocus', () => {
  it('parks the caret on the first empty slot, not the first slot', async () => {
    const { container } = await render(<Controlled length={6} />)
    const el = input()
    await el.focus()
    await userEvent.keyboard('123')
    el.blur()
    await el.focus()
    // The caret resumes at the first empty slot...
    expect([el.selectionStart, el.selectionEnd]).toEqual([3, 3])
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-rx-otp-slot]')[3]?.hasAttribute('data-active')).toBe(
        true,
      )
    })
    // ...so typing continues the code instead of mangling its head.
    await userEvent.keyboard('456')
    expect(input().value).toBe('123456')
  })

  it('selects the last character when refocusing a full code', async () => {
    await render(<Controlled length={6} />)
    const el = input()
    await el.focus()
    await userEvent.keyboard('123456')
    el.blur()
    await el.focus()
    expect([el.selectionStart, el.selectionEnd]).toEqual([5, 6])
    await userEvent.keyboard('9')
    expect(input().value).toBe('123459')
  })
})

describe('paste', () => {
  it('strips separators from a formatted code and distributes it', async () => {
    const { container } = await render(<Controlled length={6} />)
    const el = input()
    await el.focus()
    firePaste(el, '123-456')
    await vi.waitFor(() => {
      expect(input().value).toBe('123456')
    })
    expect(slotChars(container)).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('truncates an over-length paste', async () => {
    await render(<Controlled length={4} />)
    const el = input()
    await el.focus()
    firePaste(el, '123456789')
    await vi.waitFor(() => {
      expect(input().value).toBe('1234')
    })
  })

  it('replaces the current selection', async () => {
    await render(<Controlled length={6} defaultValue="" />)
    const el = input()
    await el.focus()
    await userEvent.keyboard('123456')
    el.setSelectionRange(1, 4)
    firePaste(el, '9')
    await vi.waitFor(() => {
      expect(input().value).toBe('1956')
    })
  })
})

describe('IME composition', () => {
  it('does not commit mid-composition, and commits the result on compositionend', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <OtpInput length={6} defaultValue="" onChange={onChange} label="Code" />,
    )
    const el = input()
    await el.focus()

    // Composition begins; the input holds not-yet-converted text.
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    el.value = '5'
    el.dispatchEvent(new Event('input', { bubbles: true }))
    // The intermediate input event is ignored while composing.
    expect(onChange).not.toHaveBeenCalled()
    expect(slotChars(container)[0]).toBe('')

    // Composition ends with a committed value.
    el.value = '5'
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    await vi.waitFor(() => {
      expect(input().value).toBe('5')
    })
    expect(onChange).toHaveBeenCalledWith('5')
  })

  it('resumes normal per-keystroke commits after composition', async () => {
    const { container } = await render(<Controlled length={6} />)
    const el = input()
    await el.focus()
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    el.value = '1'
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    await vi.waitFor(() => {
      expect(input().value).toBe('1')
    })
    // Plain typing after composition works as usual.
    await userEvent.keyboard('23')
    expect(slotChars(container).slice(0, 3)).toEqual(['1', '2', '3'])
  })

  it('leaves the caret collapsed mid-composition even when the code is full', async () => {
    await render(<Controlled length={6} />)
    const el = input()
    await el.focus()
    await userEvent.keyboard('123456')
    el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    // A selection sync arriving while the IME composes must not expand the
    // caret into a range — moving the selection would cancel the composition.
    el.setSelectionRange(2, 2)
    el.dispatchEvent(new Event('select', { bubbles: true }))
    expect([el.selectionStart, el.selectionEnd]).toEqual([2, 2])
    el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
  })
})

describe('backspace', () => {
  it('deletes the last character', async () => {
    const { container } = await render(<Controlled length={6} />)
    await input().focus()
    await userEvent.keyboard('123')
    await userEvent.keyboard('{Backspace}')
    expect(input().value).toBe('12')
    expect(slotChars(container).slice(0, 3)).toEqual(['1', '2', ''])
  })
})

describe('completion', () => {
  it('fires onComplete once when the value fills', async () => {
    const onComplete = vi.fn()
    await render(<Controlled length={4} onComplete={onComplete} />)
    await input().focus()
    await userEvent.keyboard('123')
    expect(onComplete).not.toHaveBeenCalled()
    await userEvent.keyboard('4')
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('1234')
  })

  it('blurs on completion when asked', async () => {
    await render(<Controlled length={4} blurOnComplete />)
    const el = input()
    await el.focus()
    expect(document.activeElement).toBe(el)
    await userEvent.keyboard('1234')
    await vi.waitFor(() => {
      expect(document.activeElement).not.toBe(el)
    })
  })
})

describe('controlled value', () => {
  it('sanitizes a garbage controlled value for display', async () => {
    const { container } = await render(
      <OtpInput length={6} value={'12ab34' as string} label="Code" />,
    )
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    expect(input().value).toBe('1234')
    expect(slotChars(container).slice(0, 4)).toEqual(['1', '2', '3', '4'])
  })
})

describe('mask & placeholder', () => {
  it('masks filled characters', async () => {
    const { container } = await render(<OtpInput length={4} value="12" mask label="Code" />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    expect(slotChars(container).slice(0, 2)).toEqual(['•', '•'])
  })

  it('shows a placeholder on empty slots only', async () => {
    const { container } = await render(
      <OtpInput length={4} value="1" placeholder="·" label="Code" />,
    )
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    expect(slotChars(container)).toEqual(['1', '·', '·', '·'])
  })
})

describe('compound & render-prop tiers', () => {
  it('renders groups and a separator, and still distributes typing', async () => {
    const { container } = await render(
      <Controlled length={6}>
        <OtpGroup>
          <OtpSlot index={0} />
          <OtpSlot index={1} />
          <OtpSlot index={2} />
        </OtpGroup>
        <OtpSeparator>–</OtpSeparator>
        <OtpGroup>
          <OtpSlot index={3} />
          <OtpSlot index={4} />
          <OtpSlot index={5} />
        </OtpGroup>
      </Controlled>,
    )
    expect(container.querySelectorAll('[data-rx-otp-group]')).toHaveLength(2)
    expect(container.querySelector('[data-rx-otp-separator]')?.textContent).toBe('–')
    await input().focus()
    await userEvent.keyboard('123456')
    expect(slotChars(container)).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('lets a slot override its own glyph via children', async () => {
    const { container } = await render(
      <OtpInput length={2} value="1" label="Code">
        <OtpSlot index={0}>X</OtpSlot>
        <OtpSlot index={1} />
      </OtpInput>,
    )
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-rx-otp-slot]')[0]?.textContent).toBe('X')
  })

  it('renders an out-of-range slot as empty instead of crashing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { container } = await render(
      <OtpInput length={2} label="Code">
        <OtpSlot index={0} />
        <OtpSlot index={5} />
      </OtpInput>,
    )
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    const slots = container.querySelectorAll('[data-rx-otp-slot]')
    expect(slots[1]?.textContent).toBe('')
    warn.mockRestore()
  })

  it('drives a fully custom render prop', async () => {
    const { container } = await render(
      <Controlled
        length={4}
        render={({ slots }) => (
          <div data-custom>
            {slots.map((s) => (
              <span key={s.index} data-cell>
                {s.char ?? '.'}
              </span>
            ))}
          </div>
        )}
      />,
    )
    await input().focus()
    await userEvent.keyboard('12')
    const cells = [...container.querySelectorAll('[data-cell]')].map((c) => c.textContent)
    expect(cells).toEqual(['1', '2', '.', '.'])
  })
})

describe('refs', () => {
  it('forwards the ref and inputRef to the same underlying input (the focusable element)', async () => {
    const captured: { fromRef: HTMLElement | null; fromInputRef: HTMLInputElement | null } = {
      fromRef: null,
      fromInputRef: null,
    }
    function Harness() {
      const inputRef = useRef<HTMLInputElement | null>(null)
      return (
        <OtpInput
          length={4}
          label="Code"
          ref={(node) => {
            captured.fromRef = node
          }}
          inputRef={inputRef}
        />
      )
    }
    await render(<Harness />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    // The forwarded ref targets the input, so focus/select/value work on it.
    expect(captured.fromRef?.getAttribute('data-rx-otp-input')).toBe('')
    captured.fromInputRef = captured.fromRef as HTMLInputElement | null
    captured.fromInputRef?.focus()
    expect(document.activeElement).toBe(captured.fromInputRef)
  })

  it('populates an object ref with the input', async () => {
    const ref = { current: null as HTMLInputElement | null }
    await render(<OtpInput length={4} label="Code" ref={ref} />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    expect(ref.current?.getAttribute('data-rx-otp-input')).toBe('')
  })
})

describe('disabled & readonly', () => {
  it('disables the input', async () => {
    await render(<OtpInput length={4} disabled value="12" label="Code" />)
    await expect.element(page.getByRole('textbox')).toBeDisabled()
  })

  it('marks the input read-only', async () => {
    await render(<OtpInput length={4} readOnly value="12" label="Code" />)
    await expect.element(page.getByRole('textbox')).toHaveAttribute('readonly')
  })
})

describe('pointer focus', () => {
  it('never moves the caret mid-code when typing starts before pointer placement settles', async () => {
    const { container } = await render(<Controlled length={6} />)
    await vi.waitFor(() => {
      expect(parseFloat(input().style.letterSpacing)).toBeGreaterThan(0)
    })

    const slots = [...container.querySelectorAll('[data-rx-otp-slot]')]
    const inputBox = input().getBoundingClientRect()
    const slotBox = slots[2]!.getBoundingClientRect()
    const clientX = slotBox.x + slotBox.width / 2
    const clientY = slotBox.y + slotBox.height / 2

    input().dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, clientX, clientY, pointerId: 1 }),
    )
    input().focus()
    input().dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
        detail: 1,
      }),
    )

    // Do not yield a frame between click and typing. The deferred spatial
    // placement is now stale and must not splice later digits before the third.
    await userEvent.keyboard('246810')
    await new Promise((resolve) => requestAnimationFrame(resolve))
    expect(inputBox.width).toBeGreaterThan(0)
    expect(input().value).toBe('246810')
    expect(slotChars(container)).toEqual(['2', '4', '6', '8', '1', '0'])
  })

  it('clicking an unfocused field at a middle slot never flashes another slot active', async () => {
    const { container } = await render(<OtpInput length={6} defaultValue="482913" label="Code" />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    // Spatial layout must be applied so the click maps to a mid-field caret.
    await vi.waitFor(() => {
      expect(parseFloat(input().style.letterSpacing)).toBeGreaterThan(0)
    })
    expect(document.activeElement).not.toBe(input())

    // Record every slot whose data-active attribute ever changes — a transient
    // flash on the wrong slot is a mutation even if it is gone by the end.
    const touched = new Set<Element>()
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) touched.add(m.target as Element)
    })
    observer.observe(container, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-active'],
    })

    // The transparent input overlays the slots, so click at the fourth slot's
    // coordinates. Engines round the caret to either side of the glyph, so the
    // assertion is about which slots activated, not the exact index.
    const slots = [...container.querySelectorAll('[data-rx-otp-slot]')]
    const inputBox = input().getBoundingClientRect()
    const slotBox = slots[3]!.getBoundingClientRect()
    await userEvent.click(input(), {
      position: {
        x: slotBox.x + slotBox.width / 2 - inputBox.x,
        y: slotBox.y + slotBox.height / 2 - inputBox.y,
      },
    })
    await vi.waitFor(() => {
      expect(container.querySelector('[data-active]')).toBeTruthy()
    })
    for (const m of observer.takeRecords()) touched.add(m.target as Element)
    observer.disconnect()

    // The caret landed mid-field, and the only slot that ever activated is the
    // one that is active now — nothing flashed on the way.
    const active = container.querySelector('[data-active]')!
    expect(slots.indexOf(active)).toBeGreaterThanOrEqual(2)
    expect(slots.indexOf(active)).toBeLessThanOrEqual(4)
    expect([...touched]).toEqual([active])
  })
})

describe('click-to-slot geometry', () => {
  /** Wait for the spatial layout, then click the input at a point inside `slot`. */
  async function clickAt(
    container: HTMLElement,
    slotIndex: number,
    at: 'top-border' | 'right-edge' | 'center',
  ) {
    await vi.waitFor(() => {
      expect(parseFloat(input().style.letterSpacing)).toBeGreaterThan(0)
    })
    const slots = [...container.querySelectorAll('[data-rx-otp-slot]')]
    const inputBox = input().getBoundingClientRect()
    const slotBox = slots[slotIndex]!.getBoundingClientRect()
    const x =
      at === 'right-edge'
        ? slotBox.x + slotBox.width - 2 - inputBox.x
        : slotBox.x + slotBox.width / 2 - inputBox.x
    const y =
      at === 'top-border' ? slotBox.y + 1 - inputBox.y : slotBox.y + slotBox.height / 2 - inputBox.y
    await userEvent.click(input(), { position: { x, y } })
  }

  function activeIndex(container: HTMLElement): number {
    const slots = [...container.querySelectorAll('[data-rx-otp-slot]')]
    return slots.findIndex((s) => s.hasAttribute('data-active'))
  }

  it('a click on a slot border of a full field activates that slot, not the first', async () => {
    // The invisible text's line box covers only part of the overlay's height;
    // the browser maps a press above it to caret 0. The geometric placement
    // must land the pressed slot regardless.
    const { container } = await render(<Controlled length={6} />)
    await input().focus()
    await userEvent.keyboard('482913')
    await clickAt(container, 3, 'top-border')
    await vi.waitFor(() => {
      expect(activeIndex(container)).toBe(3)
      expect([input().selectionStart, input().selectionEnd]).toEqual([3, 4])
    })
  })

  it('a click near a slot right edge of a full field stays in that slot', async () => {
    // Once full, the field scrolls by the trailing letter-spacing, which used
    // to shift edge clicks into the next slot.
    const { container } = await render(<Controlled length={6} />)
    await input().focus()
    await userEvent.keyboard('482913')
    await clickAt(container, 1, 'right-edge')
    await vi.waitFor(() => {
      expect(activeIndex(container)).toBe(1)
    })
  })

  it('a click lands the pressed slot across a separator', async () => {
    // A separator shifts the second group off the uniform glyph pitch; the
    // slot rects are the ground truth.
    const { container } = await render(
      <Controlled length={6}>
        <OtpGroup>
          <OtpSlot index={0} />
          <OtpSlot index={1} />
          <OtpSlot index={2} />
        </OtpGroup>
        <OtpSeparator>–</OtpSeparator>
        <OtpGroup>
          <OtpSlot index={3} />
          <OtpSlot index={4} />
          <OtpSlot index={5} />
        </OtpGroup>
      </Controlled>,
    )
    await input().focus()
    await userEvent.keyboard('482913')
    await clickAt(container, 4, 'center')
    await vi.waitFor(() => {
      expect(activeIndex(container)).toBe(4)
      expect([input().selectionStart, input().selectionEnd]).toEqual([4, 5])
    })
  })

  it('falls back to the browser caret when the renderer paints no slot ids', async () => {
    // A custom `render` prop draws its own cells — there are no
    // `${baseId}-slot-i` elements to measure, so clicks keep the native
    // mapping and focus still works.
    await render(
      <Controlled
        length={4}
        render={({ slots }) => (
          <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
            {slots.map((slot) => (
              <span key={slot.index} style={{ minWidth: '1.5rem' }}>
                {slot.char ?? '·'}
              </span>
            ))}
          </div>
        )}
      />,
    )
    await userEvent.click(input())
    await userEvent.keyboard('1234')
    expect(input().value).toBe('1234')
    await userEvent.click(input())
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(input())
    })
  })

  it('a programmatic click does not move the caret geometrically', async () => {
    await render(<Controlled length={6} />)
    await input().focus()
    await userEvent.keyboard('482913')
    input().setSelectionRange(2, 3)
    // el.click() carries no pointer coordinates (detail 0) — the caret must
    // not snap to whatever slot sits nearest to clientX 0.
    input().click()
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    expect([input().selectionStart, input().selectionEnd]).toEqual([2, 3])
  })

  it('a border click past the filled prefix parks the caret at the first empty slot', async () => {
    const { container } = await render(<Controlled length={6} />)
    await input().focus()
    await userEvent.keyboard('48')
    await clickAt(container, 5, 'top-border')
    await vi.waitFor(() => {
      expect(activeIndex(container)).toBe(2)
      expect([input().selectionStart, input().selectionEnd]).toEqual([2, 2])
    })
  })
})

describe('spatial vs crush layout', () => {
  it('spreads the glyphs to the slot pitch in spatial mode', async () => {
    await render(<OtpInput length={6} value="123456" label="Code" slotInteraction="spatial" />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    await vi.waitFor(() => {
      // A positive letter-spacing means the characters were spread to real slot
      // positions — the precondition for tapping a middle slot.
      expect(parseFloat(input().style.letterSpacing)).toBeGreaterThan(0)
    })
  })

  it('collapses the glyphs in crush mode', async () => {
    await render(<OtpInput length={6} value="123456" label="Code" slotInteraction="crush" />)
    await expect.element(page.getByRole('textbox')).toBeInTheDocument()
    await vi.waitFor(() => {
      expect(input().style.letterSpacing).toBe('-1em')
    })
  })
})
