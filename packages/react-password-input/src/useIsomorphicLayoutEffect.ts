import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * Restoring the caret after the reveal toggle swaps the input's `type` has to
 * happen before paint, or the user sees the caret jump to the end and back. On
 * the server there is no layout and no caret, and React logs a warning for any
 * `useLayoutEffect` it renders — so the server gets the effect that never runs.
 */
export const useIsomorphicLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect
