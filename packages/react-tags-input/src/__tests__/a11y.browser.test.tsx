import { describe, expect, it } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
// Static import so Vite pre-bundles axe-core with the other deps; a dynamic
// import triggers a mid-run optimize + reload that flakes the axe specs.
import axe from 'axe-core'
import { TagsInput } from '../TagsInput'

async function violations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  })
  return results.violations.map((v) => `${v.id}: ${v.help}`)
}

function box(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rx-tags-input]')!
}
function removeButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[data-rx-tags-remove]'))
}

describe('semantics', () => {
  it('is a labelled text box beside a real list', async () => {
    // A real <ul> means a screen reader announces "list, 3 items", so the user
    // knows how many tags there are before hearing them.
    const { container } = await render(
      <TagsInput label="Topics" defaultValue={['react', 'vue', 'svelte']} />,
    )
    await expect.element(page.getByLabelText('Topics')).toBeInTheDocument()
    expect(container.querySelector('[data-rx-tags-list]')?.tagName).toBe('UL')
    expect(page.getByRole('listitem').elements()).toHaveLength(3)
  })

  it('names the field without rendering a <label> element', async () => {
    // `label` is the accessible name, the same as it is on every other input in
    // the suite. A component that also painted a visible <label> would be a
    // layout decision the caller never asked for, and one its neighbours do not
    // make — so a form built from two of them could not line up.
    const { container } = await render(<TagsInput label="Topics" />)

    expect(container.querySelector('label')).toBeNull()
    expect(box(container)).toHaveAccessibleName('Topics')
  })

  it('takes a node label through a hidden element rather than dropping it', async () => {
    const { container } = await render(
      <TagsInput
        label={
          <>
            Topics <abbr title="required">*</abbr>
          </>
        }
      />,
    )

    expect(container.querySelector('label')).toBeNull()
    expect(box(container)).toHaveAccessibleName('Topics *')
  })

  it('is a text box, not a combobox', async () => {
    // Claiming `role="combobox"` with no popup is a promise to assistive
    // technology that this component cannot keep.
    const { container } = await render(<TagsInput label="Tags" />)
    expect(box(container)).not.toHaveAttribute('role')
    expect(box(container)).not.toHaveAttribute('aria-expanded')
    expect(box(container)).not.toHaveAttribute('aria-autocomplete')
  })

  it('names every remove button after its own tag', async () => {
    await render(<TagsInput label="Tags" defaultValue={['react', 'vue']} />)
    await expect.element(page.getByRole('button', { name: 'Remove react' })).toBeInTheDocument()
    await expect.element(page.getByRole('button', { name: 'Remove vue' })).toBeInTheDocument()
  })

  it('accepts a custom remove label', async () => {
    await render(
      <TagsInput label="Tags" defaultValue={['react']} removeLabel={(tag) => `Supprimer ${tag}`} />,
    )
    await expect.element(page.getByRole('button', { name: 'Supprimer react' })).toBeInTheDocument()
  })

  it('announces an addition and a removal politely', async () => {
    const { container } = await render(<TagsInput label="Tags" />)
    const live = container.querySelector('[data-rx-tags-announcement]')!
    expect(live).toHaveAttribute('aria-live', 'polite')

    box(container).focus()
    await userEvent.keyboard('react{Enter}')
    expect(live).toHaveTextContent('Added react. 1 tag.')

    await page.getByRole('button', { name: 'Remove react' }).click()
    expect(live).toHaveTextContent('Removed react. 0 tags.')
  })

  it('accepts a custom announcer', async () => {
    const { container } = await render(
      <TagsInput label="Tags" announce={({ type, tag }) => `${type}:${tag}`} />,
    )
    box(container).focus()
    await userEvent.keyboard('react{Enter}')
    expect(container.querySelector('[data-rx-tags-announcement]')).toHaveTextContent('add:react')
  })

  it('wires invalid state to aria-invalid and data-invalid', async () => {
    const { container } = await render(
      <>
        <TagsInput label="Tags" invalid aria-describedby="err" />
        <p id="err">Pick at least one</p>
      </>,
    )
    expect(box(container)).toHaveAttribute('aria-invalid', 'true')
    expect(box(container)).toHaveAttribute('aria-describedby', 'err')
    expect(container.querySelector('[data-rx-tags-root]')).toHaveAttribute('data-invalid')
  })

  it('gives the remove buttons a big enough target', async () => {
    // WCAG 2.5.8 Target Size (Minimum) is 24x24 CSS pixels.
    const { container } = await render(<TagsInput label="Tags" defaultValue={['react']} />)
    const rect = removeButtons(container)[0]!.getBoundingClientRect()
    expect(rect.width).toBeGreaterThanOrEqual(24)
    expect(rect.height).toBeGreaterThanOrEqual(24)
  })

  it('keeps a disabled field exposed rather than removing it', async () => {
    const { container } = await render(<TagsInput label="Tags" disabled defaultValue={['react']} />)
    expect(box(container)).toBeDisabled()
    expect(page.getByRole('listitem').elements()).toHaveLength(1)
  })

  it('costs one tab stop for the list and one for the box, whatever the tag count', async () => {
    const many = Array.from({ length: 20 }, (_v, index) => `tag-${String(index)}`)
    const { container } = await render(<TagsInput label="Tags" defaultValue={many} />)
    const tabbable = removeButtons(container).filter((button) => button.tabIndex === 0)
    expect(tabbable).toHaveLength(1)
  })
})

describe('axe', () => {
  it('is clean when empty', async () => {
    const { container } = await render(<TagsInput label="Tags" name="topics" />)
    expect(await violations(container)).toEqual([])
  })

  it('is clean with tags', async () => {
    const { container } = await render(
      <TagsInput label="Tags" name="topics" defaultValue={['react', 'a11y', 'testing']} />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while invalid and described', async () => {
    const { container } = await render(
      <>
        <TagsInput label="Tags" name="topics" invalid aria-describedby="err" />
        <p id="err">Pick at least one</p>
      </>,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while disabled', async () => {
    const { container } = await render(
      <TagsInput label="Tags" name="topics" disabled defaultValue={['react']} />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean while read-only, with no remove buttons at all', async () => {
    const { container } = await render(
      <TagsInput label="Tags" readOnly value={['react']} onChange={() => undefined} />,
    )
    expect(await violations(container)).toEqual([])
  })

  it('is clean in a right-to-left direction', async () => {
    const { container } = await render(
      <div dir="rtl">
        <TagsInput label="الوسوم" defaultValue={['واحد', 'اثنان']} />
      </div>,
    )
    expect(await violations(container)).toEqual([])
  })
})
