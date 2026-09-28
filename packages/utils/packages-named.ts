/**
 * How many packages a changeset's frontmatter names. Both quote styles count:
 * `changeset add` writes double quotes, and Prettier with `singleQuote` rewrites
 * them, after which a double-quote-only pattern counts zero.
 *
 * Scanned line by line rather than matched with one regex spanning the fences,
 * which backtracks badly on a file of blank lines — and a pull request can put
 * anything in these files.
 */
export const packagesNamed = (markdown: string): number => {
  const lines = markdown.split('\n').map((line) => line.trim())
  if (lines[0] !== '---') return 0
  const end = lines.indexOf('---', 1)
  if (end === -1) return 0
  return lines
    .slice(1, end)
    .filter((line) => /^("[^"]+"|'[^']+')\s*:\s*(patch|minor|major)(?:\s+#.*)?$/.test(line)).length
}
