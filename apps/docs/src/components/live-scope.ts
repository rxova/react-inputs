import React from 'react'
import * as currency from '@rxova/react-intl-currency-input'
import * as rating from '@rxova/react-rating-input'
import * as otp from '@rxova/react-otp-input'
import * as phone from '@rxova/react-phone-input'
import * as password from '@rxova/react-password-input'
import * as date from '@rxova/react-date-input'
import * as time from '@rxova/react-time-input'
import * as tags from '@rxova/react-tags-input'
import * as file from '@rxova/react-file-input'

/**
 * Everything available inside a ```tsx live code block. Spreading React exposes
 * the hooks (useState, etc.) directly, and every component's exports make the
 * suite usable without an import statement (react-live cannot process imports).
 *
 * Spread by namespace rather than symbol by symbol: a component's new export
 * used to need a matching edit here, and the failure was a runtime "X is not
 * defined" inside a doc example — visible only to whoever next opened that
 * page. Adding an input is two lines here, and its exports then follow on their
 * own.
 *
 * Not discovered by glob, unlike the playground's routes: these are bare
 * package specifiers resolved by the bundler, and `import.meta.glob` only
 * matches file paths.
 */
const liveScope = {
  React,
  ...React,
  ...currency,
  ...rating,
  ...otp,
  ...phone,
  ...password,
  ...date,
  ...time,
  ...tags,
  ...file,
}

export default liveScope
