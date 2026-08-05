import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FileInput } from '../FileInput'

/**
 * Runs in the node project, where `window` genuinely does not exist. The README
 * claims SSR/RSC safety; without this file that claim is untested.
 */
function makeFile(name: string, type = 'text/plain') {
  return new File([new Uint8Array(10)], name, { type, lastModified: 1 })
}

describe('server rendering', () => {
  it('renders the field and the drop zone without a DOM', () => {
    const html = renderToStaticMarkup(<FileInput label="Files" name="files" />)
    expect(html).toContain('data-rx-file-root')
    expect(html).toContain('data-rx-file-input')
    expect(html).toContain('data-rx-file-zone')
    expect(html).toContain('type="file"')
  })

  it('keeps the real input in the markup rather than hiding it from the tree', () => {
    // A `display: none` input is invisible to assistive technology, so the
    // no-JS form control would be gone before hydration ever runs.
    const html = renderToStaticMarkup(<FileInput label="Files" name="files" />)
    expect(html).not.toContain('display:none')
    expect(html).toContain('name="files"')
  })

  it('paints a default selection on the first pass', () => {
    const html = renderToStaticMarkup(
      <FileInput label="Files" multiple defaultValue={[makeFile('a.txt'), makeFile('b.txt')]} />,
    )
    expect(html).toContain('data-rx-file-list')
    expect(html).toContain('a.txt')
    expect(html).toContain('b.txt')
    expect(html.match(/data-rx-file-file=/g)).toHaveLength(2)
  })

  it('names every remove button after its file before hydration', () => {
    const html = renderToStaticMarkup(
      <FileInput label="Files" value={[makeFile('cv.pdf')]} onChange={() => undefined} />,
    )
    expect(html).toContain('aria-label="Remove cv.pdf"')
  })

  it('formats sizes server-side, so the first paint matches the second', () => {
    const html = renderToStaticMarkup(
      <FileInput label="Files" value={[makeFile('a.txt')]} onChange={() => undefined} />,
    )
    expect(html).toContain('10 B')
  })

  it('mints no object URLs on the server', () => {
    // `URL.createObjectURL` exists in Node, so this would silently "work" and
    // leak: nothing unmounts on the server, so nothing would ever revoke it.
    const html = renderToStaticMarkup(
      <FileInput
        label="Files"
        previews
        value={[makeFile('photo.png', 'image/png')]}
        onChange={() => undefined}
      />,
    )
    expect(html).not.toContain('blob:')
    expect(html).not.toContain('data-rx-file-preview')
    expect(html).toContain('photo.png')
  })

  it('omits the remove buttons entirely while read-only', () => {
    const html = renderToStaticMarkup(
      <FileInput label="Files" readOnly value={[makeFile('a.txt')]} onChange={() => undefined} />,
    )
    expect(html).not.toContain('data-rx-file-remove')
  })

  it('marks disabled state on both controls', () => {
    const html = renderToStaticMarkup(<FileInput label="Files" disabled />)
    expect(html.match(/disabled/g)?.length).toBeGreaterThanOrEqual(2)
    expect(html).toContain('data-disabled')
  })

  it('gives the live region its polite role before hydration', () => {
    const html = renderToStaticMarkup(<FileInput label="Files" />)
    expect(html).toContain('aria-live="polite"')
  })

  it('forwards accept and multiple to the underlying input', () => {
    const html = renderToStaticMarkup(<FileInput label="Files" multiple accept="image/*,.pdf" />)
    expect(html).toContain('accept="image/*,.pdf"')
    expect(html).toContain('multiple')
  })

  it('emits no warnings during a server pass', () => {
    // The diagnostics live in an effect, which never runs on the server — a
    // misconfigured field must still render rather than throwing mid-stream.
    let warned = 0
    const html = renderToStaticMarkup(
      <FileInput
        label="Files"
        maxFiles={0}
        onWarn={() => {
          warned += 1
        }}
      />,
    )
    expect(warned).toBe(0)
    expect(html).toContain('data-rx-file-root')
  })
})
