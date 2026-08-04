import { describe, expect, it, vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { useRef, useState } from 'react'
import { TagsInput } from '../TagsInput'
import { useTagsInput } from '../useTagsInput'

/**
 * The development-diagnostics path, the render props, and the defensive edges.
 * These need a real mount: the warnings fire from an effect and the guards are
 * only observable through real events.
 */
function box(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rtg-input]')!
}
function labels(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rtg-tag-label]')).map((e) => e.textContent)
}

describe('onWarn', () => {
  it('names the controlled prop when the value is controlled', async () => {
    const onWarn = vi.fn()
    await render(
      <TagsInput
        label="Tags"
        value={'nope' as unknown as string[]}
        onChange={() => undefined}
        onWarn={onWarn}
      />,
    )
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ prop: 'value' }))
  })

  it('names defaultValue when the value is uncontrolled', async () => {
    const onWarn = vi.fn()
    await render(
      <TagsInput label="Tags" defaultValue={42 as unknown as string[]} onWarn={onWarn} />,
    )
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ prop: 'defaultValue' }))
  })

  it('says nothing when no value prop is supplied at all', async () => {
    const onWarn = vi.fn()
    await render(<TagsInput label="Tags" onWarn={onWarn} />)
    expect(onWarn).not.toHaveBeenCalled()
  })

  it('stays quiet about duplicates when they are allowed', async () => {
    const onWarn = vi.fn()
    await render(
      <TagsInput label="Tags" allowDuplicates defaultValue={['a', 'a']} onWarn={onWarn} />,
    )
    expect(onWarn.mock.calls.filter(([w]) => w.code === 'value-had-duplicates')).toHaveLength(0)
  })

  it('warns once per distinct problem, not once per keystroke', async () => {
    const onWarn = vi.fn()
    const { container } = await render(<TagsInput label="Tags" max={-1} onWarn={onWarn} />)
    box(container).focus()
    await userEvent.keyboard('a{Enter}b{Enter}')
    expect(onWarn.mock.calls.filter(([w]) => w.code === 'max-invalid')).toHaveLength(1)
  })

  it('falls back to console.warn when no handler is supplied', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      await render(<TagsInput label="Tags" defaultValue={'nope' as unknown as string[]} />)
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[react-tags-input]'))
    } finally {
      warn.mockRestore()
    }
  })
})

describe('render props and labels', () => {
  it('replaces the painted tag contents while keeping the semantics', async () => {
    const { container } = await render(
      <TagsInput
        label="Tags"
        defaultValue={['react']}
        renderTag={(state) => <b data-index={state.index}>{state.tag.toUpperCase()}</b>}
      />,
    )
    expect(container.querySelector('[data-rtg-tag-label] b')).toHaveTextContent('REACT')
    // The remove button is still named after the real tag, not the rendering.
    await expect.element(page.getByRole('button', { name: 'Remove react' })).toBeInTheDocument()
  })

  it('reports the focused flag to renderTag', async () => {
    const seen: boolean[] = []
    const { container } = await render(
      <TagsInput
        label="Tags"
        defaultValue={['react']}
        renderTag={(state) => {
          seen.push(state.focused)
          return state.tag
        }}
      />,
    )
    container.querySelector<HTMLButtonElement>('[data-rtg-remove]')!.focus()
    await vi.waitFor(() => {
      expect(seen.some(Boolean)).toBe(true)
    })
  })

  it('renders without a label element when none is given', async () => {
    const { container } = await render(<TagsInput aria-describedby="hint" />)
    expect(container.querySelector('[data-rtg-root] > label')).toBeNull()
  })

  it('shows a placeholder in the entry box', async () => {
    const { container } = await render(<TagsInput label="Tags" placeholder="Add a topic" />)
    expect(box(container)).toHaveAttribute('placeholder', 'Add a topic')
  })
})

describe('refs', () => {
  it('populates an object ref pointing at the entry box', async () => {
    function Harness() {
      const ref = useRef<HTMLInputElement>(null)
      const [tag, setTag] = useState('none')
      return (
        <>
          <TagsInput label="Tags" ref={ref} />
          <button
            type="button"
            onClick={() => {
              setTag(ref.current?.getAttribute('data-rtg-input') === '' ? 'entry' : 'other')
            }}
          >
            Read ref
          </button>
          <output data-testid="tag">{tag}</output>
        </>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Read ref' }).click()
    await expect.element(page.getByTestId('tag')).toHaveTextContent('entry')
  })
})

describe('guards', () => {
  it('ignores modified keys, leaving them to the browser', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    box(container).focus()
    await userEvent.keyboard('react')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(labels(container)).toEqual([])
  })

  it('does not commit an empty box on a Tab delimiter, which would trap focus', async () => {
    const { container } = await render(
      <>
        <TagsInput label="Tags" delimiters={['Tab', 'Enter']} />
        <button type="button">After</button>
      </>,
    )
    box(container).focus()
    await userEvent.tab()
    await expect.element(page.getByRole('button', { name: 'After' })).toHaveFocus()
  })

  it('commits on Tab when the box has text, and stays put', async () => {
    const { container } = await render(<TagsInput label="Tags" delimiters={['Tab', 'Enter']} />)
    box(container).focus()
    await userEvent.keyboard('react')
    await userEvent.tab()
    expect(labels(container)).toEqual(['react'])
  })

  it('refuses paste splitting when it is turned off', async () => {
    const { container } = await render(<TagsInput label="Tags" splitPaste={false} />)
    const input = box(container)
    input.focus()
    const data = new DataTransfer()
    data.setData('text', 'a,b,c')
    const event = new ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    })
    input.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(labels(container)).toEqual([])
  })

  it('ignores a paste while disabled', async () => {
    const { container } = await render(<TagsInput label="Tags" disabled />)
    const input = box(container)
    const data = new DataTransfer()
    data.setData('text', 'a,b')
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
    expect(labels(container)).toEqual([])
  })

  it('ignores key handling while read-only', async () => {
    const { container } = await render(
      <TagsInput label="Tags" readOnly value={['a']} onChange={() => undefined} />,
    )
    const input = box(container)
    input.focus()
    // The DOM refuses the keystroke and the hook refuses it again.
    await userEvent.keyboard('{Backspace}')
    expect(labels(container)).toEqual(['a'])
  })

  it('does nothing when moveActive is called with no tags', async () => {
    function Harness() {
      const field = useTagsInput({})
      return (
        <>
          <output data-testid="count">{String(field.tags.length)}</output>
          <output data-testid="active">{String(field.activeIndex)}</output>
          <button
            type="button"
            onClick={() => {
              field.moveActive(1)
            }}
          >
            Move
          </button>
        </>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Move' }).click()
    await expect.element(page.getByTestId('active')).toHaveTextContent('-1')
  })

  it('ignores removeAt for an index that does not exist', async () => {
    const onRemove = vi.fn()
    function Harness() {
      const field = useTagsInput({ defaultValue: ['a'], onRemove })
      return (
        <>
          <output data-testid="count">{String(field.tags.length)}</output>
          <button
            type="button"
            onClick={() => {
              field.removeAt(9)
            }}
          >
            Remove ghost
          </button>
        </>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Remove ghost' }).click()
    await expect.element(page.getByTestId('count')).toHaveTextContent('1')
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('populates a callback ref as well as an object one', async () => {
    let node: HTMLInputElement | null = null
    const { container } = await render(
      <TagsInput
        label="Tags"
        ref={(element) => {
          node = element
        }}
      />,
    )
    expect(node).toBe(box(container))
  })

  it('leaves a modified key on a tag to the browser', async () => {
    const { container } = await render(<TagsInput label="Tags" defaultValue={['a', 'b']} />)
    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-rtg-remove]')
    buttons[0]!.focus()
    await userEvent.keyboard('{Control>}{Backspace}{/Control}')
    expect(labels(container)).toEqual(['a', 'b'])
  })

  it('says nothing when a paste is entirely rejected', async () => {
    const onReject = vi.fn()
    const { container } = await render(
      <TagsInput label="Tags" defaultValue={['a', 'b']} onReject={onReject} />,
    )
    const input = box(container)
    input.focus()
    const data = new DataTransfer()
    data.setData('text', 'a,b')
    input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }))
    await vi.waitFor(() => {
      expect(onReject).toHaveBeenCalledTimes(2)
    })
    expect(labels(container)).toEqual(['a', 'b'])
    expect(container.querySelector('[data-rtg-announcement]')?.textContent).toBe('')
  })

  it('moves the roving stop from the active tag when none is focused', async () => {
    function Harness() {
      const field = useTagsInput({ defaultValue: ['a', 'b', 'c'] })
      return (
        <>
          <output data-testid="active">{String(field.activeIndex)}</output>
          <button
            type="button"
            onClick={() => {
              field.moveActive(1)
            }}
          >
            Move
          </button>
        </>
      )
    }
    await render(<Harness />)
    // No tag has DOM focus, so the move starts from the roving index.
    await page.getByRole('button', { name: 'Move' }).click()
    await expect.element(page.getByTestId('active')).toHaveTextContent('1')
  })

  it('refuses addTag and removeAt while read-only', async () => {
    function Harness() {
      const field = useTagsInput({ defaultValue: ['a'], readOnly: true })
      return (
        <>
          <output data-testid="tags">{field.tags.join('|') || 'empty'}</output>
          <button
            type="button"
            onClick={() => {
              field.addTag('b')
            }}
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              field.removeAt(0)
            }}
          >
            Remove
          </button>
        </>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('button', { name: 'Remove' }).click()
    await expect.element(page.getByTestId('tags')).toHaveTextContent('a')
  })

  it('reports the same problem once even when the effect re-runs', async () => {
    const seen: string[] = []
    function Noisy() {
      const [tick, setTick] = useState(0)
      return (
        <>
          <TagsInput
            label="Tags"
            max={0}
            onWarn={(warning) => {
              seen.push(warning.code)
            }}
          />
          <button
            type="button"
            onClick={() => {
              setTick(tick + 1)
            }}
          >
            Re-render
          </button>
        </>
      )
    }
    await render(<Noisy />)
    await page.getByRole('button', { name: 'Re-render' }).click()
    await page.getByRole('button', { name: 'Re-render' }).click()
    expect(seen.filter((code) => code === 'max-invalid')).toHaveLength(1)
  })

  it('exposes addTag for a custom renderer', async () => {
    function Harness() {
      const field = useTagsInput({})
      return (
        <>
          <output data-testid="tags">{field.tags.join('|') || 'empty'}</output>
          <button
            type="button"
            onClick={() => {
              field.addTag('added')
            }}
          >
            Add
          </button>
        </>
      )
    }
    await render(<Harness />)
    await page.getByRole('button', { name: 'Add' }).click()
    await expect.element(page.getByTestId('tags')).toHaveTextContent('added')
  })
})
