import { afterEach, describe, expect, it, vi } from 'vitest'
import { devWarnOnce, resetWarnings } from '../warn'

afterEach(() => {
  resetWarnings()
  vi.restoreAllMocks()
  delete process.env.NODE_ENV
})

describe('devWarnOnce', () => {
  it('warns once per key and dedupes repeats', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    devWarnOnce('k', 'first')
    devWarnOnce('k', 'first again')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('[react-intl-currency-input] first')
  })

  it('warns again for a different key', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    devWarnOnce('a', 'one')
    devWarnOnce('b', 'two')
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('is a no-op in production', () => {
    process.env.NODE_ENV = 'production'
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    devWarnOnce('prod', 'should not print')
    expect(spy).not.toHaveBeenCalled()
  })
})
