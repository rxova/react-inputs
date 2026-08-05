import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { TagsInput } from '../TagsInput'
import { attemptAll, sanitize, splitPasted } from '../tags'

/**
 * Adversarial suite.
 *
 * Not "does the happy path work" — the other files cover that. Each of these is
 * an attempt to break the component: hostile props, hostile input, and the
 * focus and announcement invariants the README claims.
 */
function box(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rx-tags-input]')!
}
function labels(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rx-tags-label]')).map((e) => e.textContent)
}
function removeButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[data-rx-tags-remove]'))
}
function paste(input: HTMLInputElement, text: string) {
  const data = new DataTransfer()
  data.setData('text', text)
  input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
}

describe('hostile props', () => {
  it('renders an empty list for a value that is not an array', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <TagsInput label="Tags" value={'react,vue' as unknown as string[]} onWarn={onWarn} />,
    )
    expect(labels(container)).toEqual([])
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'value-not-array' }))
  })

  it('drops non-string entries rather than stringifying them', async () => {
    // A tag reading "undefined" or "[object Object]" is worse than a missing one.
    const onWarn = vi.fn()
    const { container } = await render(
      <TagsInput
        label="Tags"
        value={['react', undefined, 42, {}, 'vue'] as unknown as string[]}
        onChange={() => undefined}
        onWarn={onWarn}
      />,
    )
    expect(labels(container)).toEqual(['react', 'vue'])
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'value-had-non-strings' }))
  })

  it('reports duplicates and over-max separately, because they are different mistakes', async () => {
    const onWarn = vi.fn()
    await render(
      <TagsInput
        label="Tags"
        value={['a', 'A', 'b', 'c']}
        max={2}
        onChange={() => undefined}
        onWarn={onWarn}
      />,
    )
    const codes = onWarn.mock.calls.map(([w]) => w.code)
    expect(codes).toContain('value-had-duplicates')
    expect(codes).toContain('value-over-max')
  })

  it('ignores a max that cannot bound anything', async () => {
    // A field that can hold no tags is not a field.
    const onWarn = vi.fn()
    const { container } = await render(<TagsInput label="Tags" max={0} onWarn={onWarn} />)
    box(container).focus()
    await userEvent.keyboard('react{Enter}')
    expect(labels(container)).toEqual(['react'])
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'max-invalid' }))
  })

  it('drops an impossible length range whole, not by halves', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <TagsInput label="Tags" minLength={10} maxLength={3} onWarn={onWarn} />,
    )
    box(container).focus()
    await userEvent.keyboard('react{Enter}')
    // Neither bound applies, so a five-character tag is accepted.
    expect(labels(container)).toEqual(['react'])
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'length-range-invalid' }))
  })

  it('falls back to Enter when delimiters is empty', async () => {
    // With nothing to commit on, the field looks broken.
    const onWarn = vi.fn()
    const { container } = await render(<TagsInput label="Tags" delimiters={[]} onWarn={onWarn} />)
    box(container).focus()
    await userEvent.keyboard('react{Enter}')
    expect(labels(container)).toEqual(['react'])
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'no-delimiters' }))
  })

  it('survives a validate that throws, refusing rather than crashing', async () => {
    const onReject = vi.fn()
    const { container } = await render(
      <TagsInput
        label="Tags"
        validate={() => {
          throw new Error('boom')
        }}
        onReject={onReject}
      />,
    )
    box(container).focus()
    await userEvent.keyboard('react{Enter}')
    expect(labels(container)).toEqual([])
    expect(box(container).value).toBe('react')
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'invalid' }))
  })

  it('survives a transform that throws by behaving as if it were absent', async () => {
    const { container } = await render(
      <TagsInput
        label="Tags"
        transform={() => {
          throw new Error('boom')
        }}
      />,
    )
    box(container).focus()
    await userEvent.keyboard('  react  {Enter}')
    expect(labels(container)).toEqual(['react'])
  })
})

describe('hostile input', () => {
  it('never creates an empty or whitespace-only tag', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    box(container).focus()
    await userEvent.keyboard('{Enter}{Enter}   {Enter},,')
    expect(labels(container)).toEqual([])
  })

  it('escapes markup in a tag instead of rendering it', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    box(container).focus()
    await userEvent.keyboard('<img src=x onerror="alert(1)">{Enter}')
    expect(labels(container)).toHaveLength(1)
    expect(container.querySelector('[data-rx-tags-list] img')).toBeNull()
  })

  it('handles a huge paste in linear time', async () => {
    // Someone pastes a spreadsheet column. Every stage has to stay linear.
    //
    // Measured as a ratio, not against a millisecond budget: this suite runs
    // beside every other package's browser tests, and a loaded machine misses
    // a fixed target while the code under test is perfectly linear. The shape
    // of the curve is the actual claim — quadratic work grows ~16x for a 4x
    // input, linear stays near 4x. The bar sits at 10 rather than at 5: under a
    // loaded machine the ratio of two short measurements drifts well past the
    // ideal 4, and the claim worth defending is "not quadratic" — the
    // per-candidate rescan this replaced measured 13x-18x here.
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

    const paste = (length: number) =>
      Array.from({ length }, (_v, index) => `tag-${String(index)}`).join(',')
    const small = paste(1250)
    const large = paste(5000)

    const process = (text: string) => () => {
      attemptAll([], splitPasted(text, [',']))
    }
    const growth = fastest(process(large)) / fastest(process(small))

    expect(growth).toBeLessThan(10)
    expect(attemptAll([], splitPasted(large, [','])).tags).toHaveLength(5000)
  })

  it('announces a batch paste once, not once per tag', async () => {
    // Saying each of forty pasted tags in turn is not information, it is a
    // denial of service on the screen reader.
    const { container } = await render(<TagsInput label="Tags" />)
    const input = box(container)
    input.focus()
    paste(input, 'a,b,c,d,e')
    await vi.waitFor(() => {
      expect(labels(container)).toHaveLength(5)
    })
    const announcement = container.querySelector('[data-rx-tags-announcement]')!.textContent ?? ''
    expect(announcement).toContain('5 tags')
    expect(announcement).not.toContain('a.')
  })

  it('refuses a paste that would overflow max, keeping what fits', async () => {
    const { container } = await render(<TagsInput label="Tags" max={2} onWarn={() => undefined} />)
    const input = box(container)
    input.focus()
    paste(input, 'a,b,c,d')
    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['a', 'b'])
    })
  })

  it('keeps a tag that contains the delimiter, when transform puts it there', async () => {
    // The delimiter splits *input*, not stored values. A transform that
    // introduces one must not corrupt the list.
    const { container } = await render(<TagsInput label="Tags" transform={(raw) => `${raw},x`} />)
    box(container).focus()
    await userEvent.keyboard('a{Enter}')
    expect(labels(container)).toEqual(['a,x'])
  })

  it('handles non-Latin and emoji tags without mangling them', async () => {
    // Filled rather than typed: the CDP keyboard channel mangles astral
    // characters into replacement chars, so typing them would test the harness
    // rather than the component. `maxLength: 4` also proves the length check
    // counts codepoints — two emoji are two characters, not four.
    const { container } = await render(<TagsInput label="Tags" maxLength={4} />)
    const input = box(container)
    await userEvent.fill(input, '日本語')
    await userEvent.keyboard('{Enter}')
    await userEvent.fill(input, '🔐🔑')
    await userEvent.keyboard('{Enter}')
    expect(labels(container)).toEqual(['日本語', '🔐🔑'])
  })

  it('cannot be arrowed out of the tag list into nothing', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b']} />)
    removeButtons(container)[0]!.focus()
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}')
    expect(document.activeElement).toBe(removeButtons(container)[0])
  })
})

describe('invariants', () => {
  it('never emits a list containing a duplicate or an empty string', async () => {
    const seen: string[][] = []
    const { container } = await render(
      <TagsInput
        label="Tags"
        onChange={(tags) => {
          seen.push(tags)
        }}
      />,
    )
    const input = box(container)
    // Cleared between attempts on purpose: a *refused* entry deliberately stays
    // in the box (see the "leaves a refused entry" test), so typing straight on
    // would append to it and the next candidate would be a different string.
    for (const attemptText of ['a', 'A', '  ', 'b']) {
      await userEvent.fill(input, attemptText)
      await userEvent.keyboard('{Enter}')
      await userEvent.fill(input, '')
    }
    paste(input, 'b,c,C')
    await vi.waitFor(() => {
      expect(labels(container)).toEqual(['a', 'b', 'c'])
    })
    for (const list of seen) {
      expect(list.filter((tag) => tag.trim() === '')).toHaveLength(0)
      expect(new Set(list.map((tag) => tag.toLowerCase())).size).toBe(list.length)
    }
  })

  it('gives every remove button a name that identifies its own tag', async () => {
    // A list of buttons all called "Remove" is unusable in a screen reader's
    // element list, where they appear stripped of their surrounding text.
    const { container } = await render(
      <TagsInput label="Tags" defaultValue={['react', 'vue', 'svelte']} />,
    )
    const names = removeButtons(container).map((button) => button.getAttribute('aria-label'))
    expect(names).toEqual(['Remove react', 'Remove vue', 'Remove svelte'])
    expect(new Set(names).size).toBe(names.length)
  })

  it('never leaves focus on the document body after a removal', async () => {
    // Sweeping every position, because the failure only shows at the ends.
    for (const index of [0, 1, 2]) {
      const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b', 'c']} />)
      removeButtons(container)[index]!.focus()
      await userEvent.keyboard('{Backspace}')
      expect(document.activeElement).not.toBe(document.body)
      expect(container.contains(document.activeElement)).toBe(true)
    }
  })

  it('keeps exactly one tab stop in the list at all times', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b', 'c']} />)
    const count = () => removeButtons(container).filter((b) => b.tabIndex === 0).length
    expect(count()).toBe(1)
    removeButtons(container)[2]!.focus()
    expect(count()).toBe(1)
    await userEvent.keyboard('{Backspace}')
    expect(count()).toBe(1)
  })

  it('does not fight a controlled parent that refuses a change', async () => {
    // The parent owns the list; the field must show what the parent holds
    // rather than drifting to its own copy.
    function Frozen() {
      const [tags] = useState<string[]>(['react'])
      return <TagsInput label="Tags" value={tags} onChange={() => undefined} />
    }
    const { container } = await render(<Frozen />)
    box(container).focus()
    await userEvent.keyboard('vue{Enter}')
    expect(labels(container)).toEqual(['react'])
  })

  it('sanitises a controlled value the rules reject rather than displaying it', async () => {
    // Copying the prop into state instead would let the two drift, and the
    // field would keep showing a tag the parent no longer believes in.
    const { container } = await render(
      <TagsInput
        label="Tags"
        value={['a', 'a', ' ', 'b']}
        onChange={() => undefined}
        onWarn={() => undefined}
      />,
    )
    expect(labels(container)).toEqual(['a', 'b'])
    expect(sanitize(['a', 'a', ' ', 'b'])).toEqual(['a', 'b'])
  })

  it('keeps the posted values and the visible tags in agreement', async () => {
    const { container } = await render(<TagsInput label="Tags" name="topics" />)
    box(container).focus()
    await userEvent.keyboard('  React  {Enter}vue{Enter}')
    const hidden = Array.from(
      container.querySelectorAll<HTMLInputElement>('[data-rx-tags-value]'),
    ).map((input) => input.value)
    expect(hidden).toEqual(labels(container))
    expect(hidden).toEqual(['React', 'vue'])
  })

  it('does not leak state between two fields on the same page', async () => {
    const { container } = await render(
      <>
        <TagsInput label="First" defaultValue={['a']} />
        <TagsInput label="Second" defaultValue={['b']} />
      </>,
    )
    const roots = container.querySelectorAll<HTMLElement>('[data-rx-tags-root]')
    box(roots[0]!).focus()
    await userEvent.keyboard('x{Enter}')
    expect(labels(roots[0]!)).toEqual(['a', 'x'])
    expect(labels(roots[1]!)).toEqual(['b'])

    const ids = Array.from(container.querySelectorAll('[id]')).map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('respects an announce that returns nothing', async () => {
    const { container } = await render(<TagsInput label="Tags" announce={() => ''} />)
    box(container).focus()
    await userEvent.keyboard('react{Enter}')
    expect(container.querySelector('[data-rx-tags-announcement]')?.textContent).toBe('')
  })
})
