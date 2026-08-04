import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * Restoring the caret after as-you-type reformatting has to happen before
 * paint, or the user watches it jump to the end and back on every keystroke. On
 * the server there is no layout and no caret, and React logs a warning for any
 * `useLayoutEffect` it renders — so the server gets the effect that never runs.
 */
export const useIsomorphicLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect
