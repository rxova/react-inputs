import { execFileSync } from 'node:child_process'

/**
 * The paths `base...head` touched — what the pull request changed since it
 * left its base, not what the base did meanwhile. With `existing`, only the
 * paths still present at `head`, so a pull request that deletes a changeset
 * does not count as adding one.
 *
 * Renames are listed as a deletion plus an addition: with rename detection on,
 * `--name-only` prints only the new path, and a shipped file moved out of its
 * package would leave its old, shipped location out of the diff.
 *
 * A revision that starts with a dash is refused: git would read it as an
 * option, and some options in that position run commands.
 */
export const gitDiff = (
  base: string,
  head: string,
  { existing = false, cwd }: { existing?: boolean; cwd?: string } = {},
): string[] => {
  for (const revision of [base, head]) {
    if (revision.startsWith('-')) {
      throw new Error(`revision "${revision}" starts with a dash, which git reads as an option`)
    }
  }
  return execFileSync(
    'git',
    [
      'diff',
      '--name-only',
      '--no-renames',
      ...(existing ? ['--diff-filter=d'] : []),
      `${base}...${head}`,
    ],
    { encoding: 'utf8', cwd },
  )
    .split('\n')
    .filter(Boolean)
}
