import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TagsInput } from '../TagsInput'

/**
 * Runs in the node project, where `window` genuinely does not exist. The README
 * claims SSR/RSC safety; without this file that claim is untested.
 */
describe('server rendering', () => {
  it('renders the list and the entry box without a DOM', () => {
    const html = renderToStaticMarkup(<TagsInput label="Tags" defaultValue={['react', 'vue']} />)
    expect(html).toContain('data-rx-tags-root')
    expect(html).toContain('data-rx-tags-list')
    expect(html).toContain('data-rx-tags-input')
    expect(html).toContain('react')
    expect(html).toContain('vue')
  })

  it('names every remove button after its tag on the first paint', () => {
    const html = renderToStaticMarkup(<TagsInput label="Tags" defaultValue={['react']} />)
    expect(html).toContain('aria-label="Remove react"')
  })

  it('emits one hidden input per tag, so a no-JS form still posts them', () => {
    const html = renderToStaticMarkup(
      <TagsInput label="Tags" name="topics" defaultValue={['a', 'b']} />,
    )
    expect(html.match(/data-rx-tags-value/g)).toHaveLength(2)
    expect(html).toContain('value="a"')
    expect(html).toContain('value="b"')
  })

  it('omits hidden inputs without a name', () => {
    const html = renderToStaticMarkup(<TagsInput label="Tags" defaultValue={['a']} />)
    expect(html).not.toContain('data-rx-tags-value')
  })

  it('sanitises a controlled value server-side, not just on the client', () => {
    const html = renderToStaticMarkup(
      <TagsInput label="Tags" value={['a', 'a', '  ', 'b']} onChange={() => undefined} />,
    )
    expect(html.match(/data-rx-tags-tag=/g)).toHaveLength(2)
  })

  it('omits the remove buttons entirely while read-only', () => {
    const html = renderToStaticMarkup(
      <TagsInput label="Tags" readOnly value={['a']} onChange={() => undefined} />,
    )
    expect(html).not.toContain('data-rx-tags-remove')
  })

  it('gives the live region its polite role before hydration', () => {
    const html = renderToStaticMarkup(<TagsInput label="Tags" />)
    expect(html).toContain('aria-live="polite"')
  })
})
