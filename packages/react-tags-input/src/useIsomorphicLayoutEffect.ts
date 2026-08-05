import { useEffect, useLayoutEffect } from 'react'

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server.
 *
 * A paste that splits into tags is consumed rather than let through, so the
 * component owns what is left in the box and where the caret sits in it. That
 * has to be restored before paint, or the user watches the caret jump to the
 * end and back. On the server there is no layout and no caret, and React logs a
 * warning for any `useLayoutEffect` it renders — so the server gets the effect
 * that never runs.
 */
export const useIsomorphicLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect
