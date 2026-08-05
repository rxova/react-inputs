import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

/**
 * A gate step: either a package.json script, or one Turbo invocation — never
 * both and never neither. That invariant is asserted by `stepInvocation` below
 * and pinned by verify.test.ts, rather than expressed as a discriminated union:
 * this repo sets `exactOptionalPropertyTypes: false`, which stops `?: never`
 * from discriminating, and its lint config forbids both `!` and the `as` form
 * that would otherwise paper over it.
 */
export interface VerifyStep {
  readonly name: string
  readonly script?: string
  readonly turbo?: readonly string[]
}

/** Just the part of spawnSync's result the runner reads. */
export interface StepResult {
  readonly status: number | null
  readonly error?: unknown
}

export interface RunVerifyOptions {
  log?: (message: string) => void
  error?: (message: unknown) => void
  runScript?: (step: VerifyStep) => StepResult
  only?: readonly string[] | null
}

/**
 * One ordered definition of "is this releasable", executed locally by the
 * pre-push hook. CI runs the same checks split across parallel jobs, and the
 * release workflow gates on that CI run succeeding rather than re-running them.
 *
 * The point of a single list is that the local pre-push gate and CI cannot
 * drift: if the audit lived only in the CI workflow, a green local push could
 * still be carrying dependencies CI would have blocked.
 *
 * Ordered cheapest-and-most-likely-to-fail first, so a broken build surfaces
 * in seconds rather than after the browser suite.
 */
/**
 * Every step below is skip-cheap when nothing it reads has changed, and the
 * skipping is driven by *content hashes*, never by a git diff. That distinction
 * is the whole design: `--filter=[HEAD^1]`-style scoping asks git "what changed
 * since some ref", which has no good answer mid-rebase (detached HEAD), after a
 * cherry-pick (the range spans unrelated commits) or on a merge (two parents).
 * Turbo instead hashes the actual file contents that feed each task, so a
 * rebased, cherry-picked or merged tree that ends up byte-identical replays the
 * cache, and one that does not re-runs exactly the packages that differ. There
 * is no git state that can make it silently under-check.
 *
 * The non-Turbo steps get the same property from their own content caches:
 * eslint and prettier both key on file content + config, so an unchanged file
 * is never re-read.
 */
export const steps: readonly VerifyStep[] = [
  { name: 'Audit dependencies', script: 'audit:check' },
  // Cached by Turbo on the lockfile + manifests (see turbo.json) rather than
  // run directly, which is what turns this from the slowest step in the gate
  // into a replay whenever the dependency graph is untouched.
  { name: 'Check dependency dedupe', turbo: ['//#dedupe:check'] },
  { name: 'Check formatting', script: 'format:check' },
  // Runs the checker directly rather than through Turbo: unlike the CI job,
  // which replays a warm remote cache, the pre-push gate should re-verify the
  // snippets from scratch. It is a sub-second parse pass, so there is nothing
  // to save by caching it here.
  { name: 'Check doc snippets', script: 'check:docs' },
  // Next to check:docs, and for the same reason: both read the authored prose
  // that ships in the tarball, and both are sub-second parse passes worth doing
  // before anything expensive runs.
  { name: 'Check agent llms.txt files', script: 'check:llms' },
  // Same neighbourhood, same reason: a styling hook outside its component's
  // namespace is a compatibility break that nothing else in the gate would
  // notice, and the scan is a sub-second read of the component sources.
  { name: 'Check styling token namespaces', script: 'check:tokens' },
  { name: 'Check e2e browser list', script: 'check:browsers' },
  { name: 'Lint', script: 'lint' },
  // One Turbo invocation instead of four sequential `pnpm run`s. Turbo already
  // knows build must precede size and ^build must precede typecheck/test, so
  // handing it the whole set at once lets it parallelise across packages and
  // pay the ~1s pnpm+turbo startup once rather than four times.
  {
    name: 'Typecheck, test, build and size budgets',
    turbo: ['typecheck', 'test:coverage', 'build', 'size'],
  },
  // Kept out of the combined run: both shell out to a real pack/install into a
  // temp dir, and running them concurrently with anything else (or each other)
  // races on the pnpm store, hence --concurrency=1 in their root scripts.
  { name: 'Check package publishing metadata', script: 'check:exports' },
  { name: 'Smoke-test the package tarball', script: 'pack:smoke' },
]

/** The argv a step maps to, and the single point where the invariant is checked. */
export const stepInvocation = (step: VerifyStep): readonly string[] => {
  if (step.turbo !== undefined) return ['exec', 'turbo', 'run', ...step.turbo]
  const { script } = step
  if (script === undefined) {
    throw new Error(`verify step "${step.name}" declares neither \`script\` nor \`turbo\``)
  }
  return ['run', script]
}

const runPnpmScript = (step: VerifyStep): StepResult =>
  spawnSync('pnpm', [...stepInvocation(step)], { stdio: 'inherit' })

export function runVerify({
  log = console.log,
  error = console.error,
  runScript = runPnpmScript,
  only = null,
}: RunVerifyOptions = {}): number {
  // Ids, not names: the `only` filter selects by script name or turbo task.
  const idsOf = (step: VerifyStep): readonly string[] =>
    step.turbo ?? (step.script === undefined ? [] : [step.script])
  const selected = only ? steps.filter((s) => idsOf(s).some((id) => only.includes(id))) : steps

  for (const step of selected) {
    log(`\n==> ${step.name}`)
    const result = runScript(step)

    if (result.error) {
      error(result.error)
      return 1
    }
    if (result.status !== 0) {
      const invocation = `pnpm ${stepInvocation(step).join(' ')}`
      error(`\n✖ Failed: ${step.name} (${invocation})`)
      return result.status ?? 1
    }
  }

  log(`\n✔ ${String(selected.length)} checks passed`)
  return 0
}

// Compares full URLs, not basenames. The previous form matched on the file
// name alone, so importing this module from a test whose own path happened to
// end in `verify.ts` would have run the entire gate.
const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntrypoint) {
  process.exit(runVerify())
}
