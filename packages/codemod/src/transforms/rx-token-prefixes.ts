import type { FileInfo } from 'jscodeshift'

/**
 * jscodeshift transform: move the 1.0 styling hooks into their namespaces.
 *
 * `@rxova/react-otp-input` renamed `--otp-*` to `--rx-otp-*` and `data-otp-*` to
 * `data-rx-otp-*`; `@rxova/react-rating-input` renamed `--rfs-*` and `data-rfs-*`
 * the same way. Only those two packages are covered, because they are the only
 * two whose old names ever shipped.
 *
 * **This one rewrites text and never parses.** Two reasons, and the second is
 * the one that matters:
 *
 * 1. A hyphen cannot appear in a JavaScript identifier, so `--otp-` and
 *    `data-otp-` are unambiguous wherever they occur — in a style-object key, a
 *    `var()` fallback, a `querySelector` argument, a styled-components template,
 *    a Tailwind arbitrary variant, a JSX attribute name, or a comment. There is
 *    no context where the substring means something this rename should spare.
 *    Going through the AST found strictly fewer of them, and recast reprints
 *    every literal it touches with its own quote style — turning a token rename
 *    into a diff across every string in the file, in a codebase that has already
 *    decided about quotes.
 *
 * 2. Not parsing means this runs over `.css`, `.scss` and `.module.css` too,
 *    which is where most of these names actually live. jscodeshift only parses
 *    when a transform asks it to, so passing `--extensions css,tsx,ts` works:
 *
 *        npx @rxova/codemod rx-token-prefixes --extensions css,tsx,ts,jsx,js src
 *
 * Applying it twice is a no-op: `--rx-otp-` does not contain `--otp-`.
 */

/** Old prefix → new prefix. Longest first so no rule can eat another's match. */
const PREFIXES: readonly (readonly [string, string])[] = [
  ['data-otp-', 'data-rx-otp-'],
  ['data-rfs-', 'data-rx-rating-'],
  ['--otp-', '--rx-otp-'],
  ['--rfs-', '--rx-rating-'],
]

/**
 * The rewritten text, or `null` when nothing in it was a renamed hook.
 *
 * Not exported: a transform module must have exactly one export for the Runner
 * to load it unambiguously, and mixing a named export with the default one also
 * makes the bundler warn about how consumers would have to reach `.default`.
 */
function rewrite(text: string): string | null {
  let next = text
  for (const [from, to] of PREFIXES) next = next.split(from).join(to)
  return next === text ? null : next
}

export default function transform(file: FileInfo): string | undefined {
  // `undefined` tells the Runner the file was left alone, which keeps it out of
  // the "changed" count and off a `--dry` report.
  return rewrite(file.source) ?? undefined
}
