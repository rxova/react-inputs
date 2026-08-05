import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useState } from 'react'
import { TagsInput } from '../TagsInput'
import { useTagsInput } from '../useTagsInput'
import type { UseTagsInputOptions } from '../useTagsInput'

/**
 * Chromium, not jsdom. Everything here depends on real focus movement between
 * sibling elements — the roving tab order, where focus lands after a removal,
 * and `relatedTarget` on blur — none of which jsdom models faithfully enough to
 * be worth asserting.
 */
function box(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rx-tags-input]')!
}

function tagLabels(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rx-tags-label]')).map(
    (element) => element.textContent,
  )
}

function removeButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[data-rx-tags-remove]'))
}

describe('adding tags', () => {
  it('commits on Enter and clears the box', async () => {
    const onChange = vi.fn()
    const { container } = await render(<TagsInput label="Tags" onChange={onChange} />)
    box(container).focus()
    await userEvent.keyboard('react{Enter}')
    expect(tagLabels(container)).toEqual(['react'])
    expect(box(container).value).toBe('')
    expect(onChange).toHaveBeenLastCalledWith(['react'])
  })

  it('commits on a comma', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    box(container).focus()
    await userEvent.keyboard('react,vue,')
    expect(tagLabels(container)).toEqual(['react', 'vue'])
  })

  it('accepts custom delimiters', async () => {
    const { container } = await render(<TagsInput label="Tags" delimiters={[' ', 'Enter']} />)
    box(container).focus()
    await userEvent.keyboard('react vue ')
    expect(tagLabels(container)).toEqual(['react', 'vue'])
  })

  it('commits on blur by default, and can be told not to', async () => {
    const withBlur = await render(
      <>
        <TagsInput label="Tags" />
        <button type="button">Elsewhere</button>
      </>,
    )
    box(withBlur.container).focus()
    await userEvent.keyboard('react')
    await page.getByRole('button', { name: 'Elsewhere' }).click()
    expect(tagLabels(withBlur.container)).toEqual(['react'])

    const without = await render(
      <>
        <TagsInput label="Tags" addOnBlur={false} />
        <button type="button">Away</button>
      </>,
    )
    box(without.container).focus()
    await userEvent.keyboard('vue')
    await page.getByRole('button', { name: 'Away' }).click()
    expect(tagLabels(without.container)).toEqual([])
  })

  it('trims and deduplicates', async () => {
    const onReject = vi.fn()
    const { container } = await render(<TagsInput label="Tags" onReject={onReject} />)
    box(container).focus()
    await userEvent.keyboard('  react  {Enter}')
    expect(tagLabels(container)).toEqual(['react'])
    await userEvent.keyboard('React{Enter}')
    expect(tagLabels(container)).toEqual(['react'])
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'duplicate' }))
  })

  it('leaves a refused entry in the box for the user to fix', async () => {
    // Clearing it would make them retype from memory a value they can no longer
    // see, which is the worst possible response to a rejection.
    const { container } = await render(<TagsInput label="Tags" defaultValue={['react']} />)
    box(container).focus()
    await userEvent.keyboard('react{Enter}')
    expect(box(container).value).toBe('react')
  })

  it('honours max and reports being full', async () => {
    const onReject = vi.fn()
    const { container } = await render(<TagsInput label="Tags" max={2} onReject={onReject} />)
    box(container).focus()
    await userEvent.keyboard('a{Enter}b{Enter}c{Enter}')
    expect(tagLabels(container)).toEqual(['a', 'b'])
    expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'max-reached' }))
    expect(container.querySelector('[data-rx-tags-root]')).toHaveAttribute('data-full')
  })

  it('applies transform and validate', async () => {
    const onReject = vi.fn()
    const { container } = await render(
      <TagsInput
        label="Tags"
        transform={(raw) => raw.toLowerCase()}
        validate={(tag) => (tag.startsWith('x') ? 'no x tags' : true)}
        onReject={onReject}
      />,
    )
    box(container).focus()
    await userEvent.keyboard('REACT{Enter}')
    expect(tagLabels(container)).toEqual(['react'])
    await userEvent.keyboard('Xstate{Enter}')
    expect(onReject).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'invalid', message: 'no x tags' }),
    )
  })

  it('fires onAdd for each accepted tag', async () => {
    const onAdd = vi.fn()
    const { container } = await render(<TagsInput label="Tags" onAdd={onAdd} />)
    box(container).focus()
    await userEvent.keyboard('a{Enter}b{Enter}')
    expect(onAdd).toHaveBeenNthCalledWith(1, 'a', ['a'])
    expect(onAdd).toHaveBeenNthCalledWith(2, 'b', ['a', 'b'])
  })
})

describe('removing tags', () => {
  it('removes on the button and reports it', async () => {
    const onRemove = vi.fn()
    const { container } = await render(
      <TagsInput label="Tags" defaultValue={['react', 'vue']} onRemove={onRemove} />,
    )
    await page.getByRole('button', { name: 'Remove react' }).click()
    expect(tagLabels(container)).toEqual(['vue'])
    expect(onRemove).toHaveBeenCalledWith('react', 0, ['vue'])
  })

  it('moves focus to the next tag, not to nowhere', async () => {
    // Leaving focus on a button that no longer exists drops it to <body>, which
    // is the single most common accessibility failure in this widget.
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b', 'c']} />)
    removeButtons(container)[0]!.focus()
    await userEvent.keyboard('{Backspace}')
    expect(tagLabels(container)).toEqual(['b', 'c'])
    expect(document.activeElement).toBe(removeButtons(container)[0])
  })

  it('falls back to the previous tag when the last one goes', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b']} />)
    removeButtons(container)[1]!.focus()
    await userEvent.keyboard('{Delete}')
    expect(tagLabels(container)).toEqual(['a'])
    expect(document.activeElement).toBe(removeButtons(container)[0])
  })

  it('falls back to the entry box when the list empties', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['only']} />)
    removeButtons(container)[0]!.focus()
    await userEvent.keyboard('{Backspace}')
    expect(tagLabels(container)).toEqual([])
    expect(document.activeElement).toBe(box(container))
  })

  it('takes two Backspaces from an empty box, not one', async () => {
    // A single Backspace that deletes outright destroys data the user cannot
    // see they are about to lose.
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b']} />)
    box(container).focus()
    await userEvent.keyboard('{Backspace}')
    expect(tagLabels(container)).toEqual(['a', 'b'])
    expect(document.activeElement).toBe(removeButtons(container)[1])
    await userEvent.keyboard('{Backspace}')
    expect(tagLabels(container)).toEqual(['a'])
  })

  it('does not reach for a tag while the box still has text', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a']} />)
    box(container).focus()
    await userEvent.keyboard('xy{Backspace}')
    expect(box(container).value).toBe('x')
    expect(tagLabels(container)).toEqual(['a'])
  })
})

describe('the roving tab order', () => {
  it('gives the whole list one tab stop', async () => {
    // Twenty tags must not cost a keyboard user twenty presses to get past.
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b', 'c']} />)
    const buttons = removeButtons(container)
    expect(buttons.map((button) => button.tabIndex)).toEqual([0, -1, -1])
  })

  it('moves between tags with the arrow keys', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b', 'c']} />)
    removeButtons(container)[0]!.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(removeButtons(container)[1])
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(removeButtons(container)[0])
  })

  it('arrows past the last tag into the entry box', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b']} />)
    removeButtons(container)[1]!.focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.activeElement).toBe(box(container))
  })

  it('jumps to the first tag with Home and to the box with End', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b', 'c']} />)
    removeButtons(container)[2]!.focus()
    await userEvent.keyboard('{Home}')
    expect(document.activeElement).toBe(removeButtons(container)[0])
    await userEvent.keyboard('{End}')
    expect(document.activeElement).toBe(box(container))
  })

  it('reaches back into the list with ArrowLeft from an empty box', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b']} />)
    box(container).focus()
    await userEvent.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(removeButtons(container)[1])
  })

  it('hands a printable keystroke to the entry box rather than swallowing it', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a']} />)
    removeButtons(container)[0]!.focus()
    await userEvent.keyboard('x')
    expect(document.activeElement).toBe(box(container))
  })

  it('tabs from the list to the box and then out', async () => {
    const { container } = await render(
      <>
        <TagsInput label="Tags" defaultValue={['a', 'b']} />
        <button type="button">After</button>
      </>,
    )
    removeButtons(container)[0]!.focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(box(container))
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'After' })).toHaveFocus()
  })
})

describe('pasting', () => {
  it('splits a multi-value paste into tags', async () => {
    const onChange = vi.fn()
    const { container } = await render(<TagsInput label="Tags" onChange={onChange} />)
    const input = box(container)
    input.focus()

    const data = new DataTransfer()
    data.setData('text', 'react, vue, svelte')
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))

    await vi.waitFor(() => {
      expect(tagLabels(container)).toEqual(['react', 'vue', 'svelte'])
    })
    expect(onChange).toHaveBeenLastCalledWith(['react', 'vue', 'svelte'])
  })

  it('splits on newlines even when the delimiter is a comma', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    const input = box(container)
    input.focus()
    const data = new DataTransfer()
    data.setData('text', 'react\nvue')
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
    await vi.waitFor(() => {
      expect(tagLabels(container)).toEqual(['react', 'vue'])
    })
  })

  it('leaves a single-value paste to the browser', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    const input = box(container)
    input.focus()
    const data = new DataTransfer()
    data.setData('text', 'react')
    const event = new ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(event)
    // Not prevented, so the text lands in the box the way the user expects.
    expect(event.defaultPrevented).toBe(false)
    expect(tagLabels(container)).toEqual([])
  })

  it('reports every rejection in a batch', async () => {
    const onReject = vi.fn()
    const { container } = await render(
      <TagsInput label="Tags" defaultValue={['react']} onReject={onReject} />,
    )
    const input = box(container)
    input.focus()
    const data = new DataTransfer()
    data.setData('text', 'react, vue, react')
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
    await vi.waitFor(() => {
      expect(tagLabels(container)).toEqual(['react', 'vue'])
    })
    expect(onReject.mock.calls.filter(([a]) => a.reason === 'duplicate')).toHaveLength(2)
  })
})

describe('controlled use and forms', () => {
  it('follows the parent', async () => {
    function Harness() {
      const [tags, setTags] = useState<string[]>(['react'])
      return (
        <>
          <TagsInput label="Tags" value={tags} onChange={setTags} />
          <button
            type="button"
            onClick={() => {
              setTags(['vue', 'svelte'])
            }}
          >
            Replace
          </button>
        </>
      )
    }
    const { container } = await render(<Harness />)
    await page.getByRole('button', { name: 'Replace' }).click()
    expect(tagLabels(container)).toEqual(['vue', 'svelte'])
  })

  it('posts one hidden input per tag, so a form gets an array', async () => {
    let submitted: string[] = []
    await render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submitted = new FormData(event.currentTarget).getAll('topics').map(String)
        }}
      >
        <TagsInput label="Topics" name="topics" defaultValue={['react', 'a11y']} />
        <button type="submit">Save</button>
      </form>,
    )
    await page.getByRole('button', { name: 'Save' }).click()
    // An array, not a comma-joined string somebody downstream has to split.
    expect(submitted).toEqual(['react', 'a11y'])
  })

  it('emits no hidden inputs without a name', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a']} />)
    expect(container.querySelector('[data-rx-tags-value]')).toBeNull()
  })

  it('requires the entry box only while the list is empty', async () => {
    const empty = await render(<TagsInput label="Tags" required />)
    expect(box(empty.container)).toBeRequired()
    const filled = await render(<TagsInput label="Tags" required defaultValue={['a']} />)
    expect(box(filled.container)).not.toBeRequired()
  })

  it('fires onBlur only when focus leaves the whole field', async () => {
    const onBlur = vi.fn()
    const { container } = await render(
      <>
        <TagsInput label="Tags" defaultValue={['a']} onBlur={onBlur} />
        <button type="button">Elsewhere</button>
      </>,
    )
    box(container).focus()
    removeButtons(container)[0]!.focus()
    expect(onBlur).not.toHaveBeenCalled()
    await page.getByRole('button', { name: 'Elsewhere' }).click()
    expect(onBlur).toHaveBeenCalledTimes(1)
  })
})

describe('states', () => {
  it('refuses everything while disabled', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TagsInput label="Tags" disabled defaultValue={['a']} onChange={onChange} />,
    )
    expect(box(container)).toBeDisabled()
    expect(removeButtons(container)[0]).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hides the remove buttons entirely while read-only', async () => {
    // A visible but inert button is a worse affordance than no button.
    const { container } = await render(
      <TagsInput label="Tags" readOnly value={['a', 'b']} onChange={() => undefined} />,
    )
    expect(removeButtons(container)).toHaveLength(0)
    expect(tagLabels(container)).toEqual(['a', 'b'])
    expect(box(container)).toHaveAttribute('readonly')
  })
})

describe('dir, autoFocus and aria-label', () => {
  it('lays the field out right-to-left', async () => {
    const { container } = await render(<TagsInput label="Topics" dir="rtl" />)

    expect(
      getComputedStyle(container.querySelector<HTMLElement>('[data-rx-tags-root]')!).direction,
    ).toBe('rtl')
  })

  it('focuses the entry box on mount with autoFocus', async () => {
    const { container } = await render(<TagsInput label="Topics" autoFocus />)

    expect(document.activeElement).toBe(container.querySelector('[data-rx-tags-input]'))
  })

  it('takes an aria-label, which wins over label', async () => {
    // Both are names; a caller passing both means the visible text and the
    // announced name differ on purpose, so the explicit one has to win.
    const { container } = await render(<TagsInput label="Topics" aria-label="Article topics" />)

    expect(container.querySelector('[data-rx-tags-input]')).toHaveAccessibleName('Article topics')
  })
})

describe('clear', () => {
  function ClearHarness(props: UseTagsInputOptions) {
    const field = useTagsInput(props)
    return (
      <div>
        <output data-testid="tags">{field.tags.join('|') || 'empty'}</output>
        <output data-testid="text">{field.text || 'empty'}</output>
        <button type="button" onClick={field.clear}>
          Clear
        </button>
      </div>
    )
  }

  it('empties the tags and the entry box together', async () => {
    // Half-clearing is the bug this exists to avoid: a caller who clears a form
    // and leaves a half-typed tag in the box has a field that still submits.
    const onChange = vi.fn()
    await render(<ClearHarness defaultValue={['react', 'a11y']} onChange={onChange} />)

    await userEvent.click(page.getByRole('button', { name: 'Clear' }))

    await expect.element(page.getByTestId('tags')).toHaveTextContent('empty')
    await expect.element(page.getByTestId('text')).toHaveTextContent('empty')
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('refuses to clear a read-only field', async () => {
    const onChange = vi.fn()
    await render(<ClearHarness defaultValue={['react']} readOnly onChange={onChange} />)

    await userEvent.click(page.getByRole('button', { name: 'Clear' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('Delete', () => {
  it('removes the focused tag, which the keyboard table promises and nothing asserted', async () => {
    const onChange = vi.fn()
    const { container } = await render(
      <TagsInput label="Topics" defaultValue={['react', 'vue']} onChange={onChange} />,
    )
    removeButtons(container)[0]!.focus()
    await userEvent.keyboard('{Delete}')

    expect(onChange).toHaveBeenCalledWith(['vue'])
  })
})
