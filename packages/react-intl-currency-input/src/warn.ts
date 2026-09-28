import { createDevWarner } from '@rxova/ts-utils'

/**
 * Development-only diagnostics, from the shared rxova dev warner.
 *
 * Warnings are deduplicated by key: a formatter rebuilt on every render must
 * not flood the console with the same message. The warner checks `NODE_ENV` on
 * every call, so it is silent in production; call sites on a hot path also sit
 * under a `process.env.NODE_ENV !== 'production'` guard so a production bundler
 * drops their message strings.
 */
const warner = createDevWarner({ prefix: 'react-intl-currency-input' })

/** Warn once per unique `key`. No-op in production. */
export const devWarnOnce = warner.warnOnce

/** Test-only: reset the dedupe set so each test starts clean. */
export const resetWarnings = warner.reset
