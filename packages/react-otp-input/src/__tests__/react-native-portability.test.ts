import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  buildSlots,
  defaultPasteTransform,
  inputModeFor,
  isComplete,
  normalizeLength,
  resolveIsAllowed,
  resolveMaskChar,
  sanitize,
  spatialLayout,
  spliceValue,
} from '../core'

/**
 * `@rxova/react-otp-input` renders a real DOM `<input>` with CSS custom properties and
 * spatial layout measured via `getComputedStyle` — it does **not** render in
 * React Native, which has no DOM. What *is* portable is the pure logic in
 * `core.ts`: sanitizing/distributing a code, mapping it to slots, and the
 * spatial geometry math. This file guards that portability so a React Native
 * (or edge / worker / any-JS-engine) consumer can reuse the logic even though
 * the rendered field is web-only — and so the core never quietly grows a DOM
 * dependency that would break outside the browser.
 */

describe('the pure core runs in a non-DOM runtime (React Native / Hermes / node)', () => {
  it('has no DOM globals in this environment', () => {
    // This spec runs in the node project, which — like React Native's JS engine
    // and a server render — has no `window` and no `document`.
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
  })

  it('runs a full receive → validate → distribute → edit flow with no browser APIs', () => {
    // The path a React Native app would drive itself: an SMS code arrives, gets
    // cleaned and validated, distributed into slots, then a slot is edited.
    const isAllowed = resolveIsAllowed('numeric', undefined)

    const cleaned = defaultPasteTransform('482-913')
    expect(cleaned).toBe('482913')

    const value = sanitize(cleaned, 6, isAllowed)
    expect(value).toBe('482913')
    expect(isComplete(value, 6)).toBe(true)

    const slots = buildSlots({
      value,
      length: 6,
      selectionStart: 6,
      selectionEnd: 6,
      isFocused: true,
      isDisabled: false,
      isReadOnly: false,
      placeholder: null,
      maskChar: resolveMaskChar(false),
    })
    expect(slots.map((s) => s.char)).toEqual(['4', '8', '2', '9', '1', '3'])

    // Editing the third slot is pure string surgery, no caret DOM needed.
    expect(spliceValue(value, 2, 3, '7', 6)).toEqual({ value: '487913', caret: 3 })
  })

  it('computes spatial geometry from plain numbers (a native layout could feed it measured px)', () => {
    // slot 40, gap 8, char 12 -> pitch 48, tracking 36, indent 14.
    expect(spatialLayout(40, 8, 12)).toEqual({ letterSpacing: 36, textIndent: 14 })
    expect(spatialLayout(0, 8, 12)).toBeNull()
  })

  it('resolves keyboard/length config without touching the platform', () => {
    expect(inputModeFor('numeric')).toBe('numeric')
    expect(inputModeFor('alpha')).toBe('text')
    expect(normalizeLength(undefined)).toBe(6)
    expect(resolveMaskChar(true)).toBe('•')
  })
})

describe('core.ts declares no DOM or browser dependency', () => {
  const source = readFileSync(fileURLToPath(new URL('../core.ts', import.meta.url)), 'utf8')

  it('imports only pure types', () => {
    const imports = source
      .split('\n')
      .map((line) => line.trimStart())
      .filter((line) => line.startsWith('import'))
    expect(imports.length).toBeGreaterThan(0)
    for (const line of imports) {
      // The only allowed import is the type-only one from ./types; no runtime
      // module, no external dependency, nothing that could reach for a DOM.
      expect(line).toMatch(/^import type .* from '\.\/types'$/)
    }
  })

  it('references no DOM or browser API identifier', () => {
    const forbidden =
      /\b(window|document|navigator|getComputedStyle|createElement|HTML[A-Za-z]*Element|localStorage|sessionStorage|requestAnimationFrame|XMLHttpRequest|CanvasRenderingContext2D)\b/
    const match = forbidden.exec(source)
    expect(match?.[0] ?? null).toBeNull()
  })
})
