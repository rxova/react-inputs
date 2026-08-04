import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { FileInput } from '../FileInput'
import { attemptAll, formatBytes, matchesAccept } from '../files'

/**
 * Adversarial suite.
 *
 * Not "does the happy path work" — the other files cover that. Each of these is
 * an attempt to break the component: hostile props, hostile files, the
 * object-URL lifecycle, and the security properties the README claims. One of
 * them found a real leak on first run; the comment says which.
 */
function makeFile(name: string, options: { type?: string; size?: number; at?: number } = {}) {
  const { type = 'text/plain', size = 10, at = 1_700_000_000_000 } = options
  return new File([new Uint8Array(size)], name, { type, lastModified: at })
}
function input(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('[data-rfi-input]')!
}
function names(container: HTMLElement) {
  return Array.from(container.querySelectorAll('[data-rfi-name]')).map((e) => e.textContent)
}
async function pick(container: HTMLElement, files: File[]) {
  const data = new DataTransfer()
  for (const file of files) data.items.add(file)
  const element = input(container)
  element.files = data.files
  element.dispatchEvent(new Event('change', { bubbles: true }))
  // Waits on the input itself rather than the root: `container` is sometimes
  // the root element, and `querySelector` only searches descendants.
  await vi.waitFor(() => {
    expect(input(container)).toBeTruthy()
  })
}

describe('the object-URL lifecycle', () => {
  it('never leaks a URL across an add-remove-add cycle', async () => {
    // The leak this component exists to prevent, and the test that found a real
    // one: the URL map was being *replaced* rather than mutated, so the unmount
    // cleanup held an empty map and every URL stayed alive for the lifetime of
    // the document.
    const create = vi.spyOn(URL, 'createObjectURL')
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    try {
      const { container } = await render(<FileInput label="Files" previews multiple />)
      for (let round = 0; round < 3; round++) {
        await pick(container, [makeFile('a.png', { type: 'image/png', at: round })])
        await vi.waitFor(() => {
          expect(container.querySelectorAll('[data-rfi-preview]')).toHaveLength(1)
        })
        await page.getByRole('button', { name: 'Remove a.png' }).click()
        await vi.waitFor(() => {
          expect(names(container)).toEqual([])
        })
      }
      // Every URL created has been revoked; none is left pinning a file.
      expect(revoke.mock.calls.length).toBe(create.mock.calls.length)
    } finally {
      create.mockRestore()
      revoke.mockRestore()
    }
  })

  it('creates no URLs at all when previews are off', async () => {
    const create = vi.spyOn(URL, 'createObjectURL')
    try {
      const { container } = await render(<FileInput label="Files" multiple />)
      await pick(container, [makeFile('a.png', { type: 'image/png' })])
      await vi.waitFor(() => {
        expect(names(container)).toEqual(['a.png'])
      })
      expect(create).not.toHaveBeenCalled()
    } finally {
      create.mockRestore()
    }
  })
})

describe('security properties the README claims', () => {
  it('never issues a network request of its own', async () => {
    // The whole point of having no upload transport: the file never leaves the
    // page unless the consuming app sends it.
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      const { container } = await render(<FileInput label="Files" multiple previews />)
      await pick(container, [makeFile('a.png', { type: 'image/png' }), makeFile('b.txt')])
      await vi.waitFor(() => {
        expect(names(container)).toHaveLength(2)
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('escapes a filename containing markup instead of rendering it', async () => {
    const { container } = await render(<FileInput label="Files" />)
    await pick(container, [makeFile('<img src=x onerror="alert(1)">.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toHaveLength(1)
    })
    expect(container.querySelector('[data-rfi-list] img')).toBeNull()
  })

  it('does not treat a doctored extension as a matching type', async () => {
    // `accept` is a convenience, never a security control — but it must at
    // least do what it says, and a `.png` name on a text file matches a `.png`
    // pattern by extension while failing an `image/*` one.
    const exe = makeFile('totally-safe.png', { type: 'application/octet-stream' })
    expect(matchesAccept(exe, '.png')).toBe(true)
    expect(matchesAccept(exe, 'image/*')).toBe(false)
  })
})

describe('hostile props', () => {
  it('ignores a maxFiles that cannot bound anything', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <FileInput label="Files" multiple maxFiles={0} onWarn={onWarn} />,
    )
    await pick(container, [makeFile('a.txt')])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.txt'])
    })
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'max-files-invalid' }))
  })

  it('drops an impossible size range whole, not by halves', async () => {
    const onWarn = vi.fn()
    const { container } = await render(
      <FileInput label="Files" minSize={1000} maxSize={10} onWarn={onWarn} />,
    )
    await pick(container, [makeFile('a.txt', { size: 100 })])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.txt'])
    })
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'size-range-invalid' }))
  })

  it('ignores a negative size bound', async () => {
    const onWarn = vi.fn()
    const { container } = await render(<FileInput label="Files" maxSize={-1} onWarn={onWarn} />)
    await pick(container, [makeFile('a.txt', { size: 100 })])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.txt'])
    })
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'negative-size' }))
  })

  it('flags an accept string that would match nothing', async () => {
    // `png` without the dot and `*.png` both look plausible and both silently
    // refuse every file, which reads as a broken field rather than a typo.
    const onWarn = vi.fn()
    await render(<FileInput label="Files" accept="png, *.pdf" onWarn={onWarn} />)
    const warning = onWarn.mock.calls.map(([w]) => w).find((w) => w.code === 'accept-suspicious')
    expect(warning).toBeDefined()
    expect(String(warning.received)).toContain('png')
    expect(String(warning.message)).toContain('image/*')
  })

  it('accepts every well-formed accept pattern without complaint', async () => {
    const onWarn = vi.fn()
    await render(
      <FileInput label="Files" accept=".png, image/*, application/pdf" onWarn={onWarn} />,
    )
    expect(onWarn.mock.calls.filter(([w]) => w.code === 'accept-suspicious')).toHaveLength(0)
  })

  it('points out a maxFiles on a single-file field, where it does nothing', async () => {
    const onWarn = vi.fn()
    await render(<FileInput label="Files" maxFiles={5} onWarn={onWarn} />)
    expect(onWarn).toHaveBeenCalledWith(expect.objectContaining({ code: 'single-with-max' }))
  })

  it('survives a validate that throws, refusing rather than crashing', async () => {
    const onReject = vi.fn()
    const { container } = await render(
      <FileInput
        label="Files"
        validate={() => {
          throw new Error('boom')
        }}
        onReject={onReject}
      />,
    )
    await pick(container, [makeFile('a.txt')])
    await vi.waitFor(() => {
      expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ reason: 'invalid' }))
    })
    expect(names(container)).toEqual([])
  })
})

describe('hostile input', () => {
  /**
   * Fastest of several runs. Scheduler noise only ever *adds* time, so the
   * minimum is the robust estimator — an average would drag toward whatever
   * else the machine was doing.
   */
  const fastest = (run: () => void, repeats = 9): number => {
    let best = Infinity
    for (let index = 0; index < repeats; index += 1) {
      const started = performance.now()
      run()
      best = Math.min(best, performance.now() - started)
    }
    return best
  }

  const selection = (length: number) =>
    Array.from({ length }, (_v, index) => makeFile(`file-${String(index)}.txt`, { at: index }))

  it('handles a large multi-file selection in linear time', async () => {
    // Someone selects a whole photo library. Every stage has to stay linear.
    //
    // Measured as a ratio, not against a millisecond budget: this suite runs
    // beside every other package's browser tests, and a loaded machine misses
    // a fixed target while the code under test is perfectly linear. The shape
    // of the curve is the actual claim — quadratic work grows ~16x for a 4x
    // input, linear stays near 4x. The bar sits at 10 rather than at 5: under a
    // loaded machine the ratio of two short measurements drifts well past the
    // ideal 4, and the claim worth defending is "not quadratic" — the
    // per-candidate rescan this replaced measured 13x-18x here.
    const small = selection(500)
    const large = selection(2000)

    const growth = fastest(() => attemptAll([], large)) / fastest(() => attemptAll([], small))

    expect(growth).toBeLessThan(10)
    expect(attemptAll([], large).files).toHaveLength(2000)
  })

  it('accepts a zero-byte file unless a minimum says otherwise', async () => {
    const { container } = await render(<FileInput label="Files" />)
    await pick(container, [makeFile('empty.txt', { size: 0 })])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['empty.txt'])
    })
    expect(container.querySelector('[data-rfi-size]')).toHaveTextContent('0 B')
  })

  it('handles a file with no extension and no type', async () => {
    const { container } = await render(<FileInput label="Files" />)
    await pick(container, [makeFile('LICENSE', { type: '' })])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['LICENSE'])
    })
  })

  it('reports a huge size without overflowing into nonsense', async () => {
    expect(formatBytes(9_000_000_000_000)).toBe('9 TB')
    expect(formatBytes(9_000_000_000_000_000)).toBe('9000 TB')
  })

  it('refuses a whole batch without announcing anything by default', async () => {
    // Interrupting the user to say "nothing happened" is noise; the rejection
    // is reported through `onReject` for the caller to show.
    const onReject = vi.fn()
    const { container } = await render(
      <FileInput label="Files" accept=".png" onReject={onReject} />,
    )
    await pick(container, [makeFile('a.txt'), makeFile('b.txt')])
    await vi.waitFor(() => {
      expect(onReject).toHaveBeenCalledTimes(2)
    })
    expect(container.querySelector('[data-rfi-announcement]')?.textContent).toBe('')
  })

  it('announces a mixed batch once, with the refused count', async () => {
    const { container } = await render(
      <FileInput label="Files" multiple accept=".txt" onReject={() => undefined} />,
    )
    await pick(container, [makeFile('a.txt'), makeFile('b.png'), makeFile('c.txt', { at: 2 })])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['a.txt', 'c.txt'])
    })
    const said = container.querySelector('[data-rfi-announcement]')?.textContent ?? ''
    expect(said).toContain('2 files')
    expect(said).toContain('1 refused')
  })
})

describe('invariants', () => {
  it('never holds more files than maxFiles, whatever the route in', async () => {
    const { container } = await render(<FileInput label="Files" multiple maxFiles={2} />)
    await pick(container, [makeFile('a'), makeFile('b'), makeFile('c')])
    await vi.waitFor(() => {
      expect(names(container)).toHaveLength(2)
    })
    const data = new DataTransfer()
    data.items.add(makeFile('d'))
    container
      .querySelector('[data-rfi-zone]')!
      .dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }))
    await vi.waitFor(() => {
      expect(names(container)).toHaveLength(2)
    })
  })

  it('never shows a file the rules would reject', async () => {
    const { container } = await render(
      <FileInput label="Files" multiple accept=".txt" maxSize={100} onReject={() => undefined} />,
    )
    await pick(container, [
      makeFile('ok.txt', { size: 50 }),
      makeFile('big.txt', { size: 500, at: 2 }),
      makeFile('wrong.png', { at: 3 }),
    ])
    await vi.waitFor(() => {
      expect(names(container)).toEqual(['ok.txt'])
    })
  })

  it('gives every remove button a name identifying its own file', async () => {
    const { container } = await render(<FileInput label="Files" multiple />)
    await pick(container, [makeFile('one.txt'), makeFile('two.txt', { at: 2 })])
    await vi.waitFor(() => {
      expect(names(container)).toHaveLength(2)
    })
    const labels = Array.from(container.querySelectorAll('[data-rfi-remove]')).map((button) =>
      button.getAttribute('aria-label'),
    )
    expect(labels).toEqual(['Remove one.txt', 'Remove two.txt'])
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('does not leak state between two fields on the same page', async () => {
    const { container } = await render(
      <>
        <FileInput label="First" multiple />
        <FileInput label="Second" multiple />
      </>,
    )
    const roots = container.querySelectorAll<HTMLElement>('[data-rfi-root]')
    await pick(roots[0]!, [makeFile('only-first.txt')])
    await vi.waitFor(() => {
      expect(names(roots[0]!)).toEqual(['only-first.txt'])
    })
    expect(names(roots[1]!)).toEqual([])

    const ids = Array.from(container.querySelectorAll('[id]')).map((element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps the native input in the accessibility tree rather than display:none', async () => {
    // `display: none` and `hidden` both remove it from that tree and, in some
    // browsers, stop `.click()` from opening the picker at all.
    const { container } = await render(<FileInput label="Files" />)
    const style = getComputedStyle(input(container))
    expect(style.display).not.toBe('none')
    expect(input(container)).not.toHaveAttribute('hidden')
  })
})
