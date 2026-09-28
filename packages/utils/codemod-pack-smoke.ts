import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { readManifest } from './manifest'

/**
 * The component packages use `rxova-repo-config pack-smoke`. The codemod cannot:
 * it exports only `./transforms/*` and has no root entry for that command's
 * import/require probe, and its bin has no `--version`. This checks what the
 * codemod actually ships instead: the bin runs, lists its transforms, and
 * rewrites a TSX fixture from the installed tarball.
 */

const pkg = readManifest(join(process.cwd(), 'package.json'))
const REQUIRED = [
  'package/dist/bin.cjs',
  'package/dist/transforms/input-otp-to-otp.cjs',
  'package/dist/transforms/input-otp-to-otp.d.cts',
  'package/package.json',
  'package/README.md',
  'package/LICENSE',
  // The agent-facing summary. npm does not include this automatically, so it
  // ships only because the manifest lists it in `files`.
  'package/llms.txt',
]
const FORBIDDEN = [/^package\/src\//, /\.test\./, /^package\/e2e\//]
const workdir = mkdtempSync(join(tmpdir(), 'rxova-codemod-pack-'))
let failures = 0

const fail = (message: string): void => {
  console.error(`  ✖ ${message}`)
  failures += 1
}

try {
  console.log(`Packing ${pkg.name}…`)
  const packOutput = execFileSync('pnpm', ['pack', '--pack-destination', workdir], {
    encoding: 'utf8',
  })
  const filename = packOutput
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.tgz'))
    .pop()
  if (!filename) throw new Error('could not determine the tarball path from `pnpm pack` output')
  const tarballPath = filename.startsWith('/') ? filename : join(workdir, filename)

  const entries = execFileSync('tar', ['-tf', tarballPath], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .map((entry) => entry.replace(/\/$/, ''))

  console.log('\nChecking tarball contents…')
  for (const required of REQUIRED) {
    if (!entries.includes(required)) fail(`missing from tarball: ${required}`)
  }
  for (const entry of entries) {
    for (const pattern of FORBIDDEN) {
      if (pattern.test(entry)) fail(`should not be published: ${entry}`)
    }
  }

  const consumer = join(workdir, 'consumer')
  mkdirSync(consumer)
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'rxova-codemod-pack-smoke',
      private: true,
      version: '1.0.0',
      dependencies: { [pkg.name]: `file:${tarballPath}` },
    }),
  )
  execFileSync('npm', ['install', '--silent', '--no-audit', '--no-fund'], {
    cwd: consumer,
    stdio: 'inherit',
  })

  const executable = join(consumer, 'node_modules', '.bin', 'rxova-codemod')
  const help = spawnSync(executable, ['--help'], { cwd: consumer, encoding: 'utf8' })
  const helpBefore = failures
  if (help.status !== 0) fail(`installed CLI --help exited with ${String(help.status)}`)
  if (!`${help.stdout}${help.stderr}`.includes('input-otp-to-otp')) {
    fail('installed CLI --help does not list input-otp-to-otp')
  }
  if (failures === helpBefore) console.log('  ✔ installed CLI is executable')

  const fixture = join(consumer, 'fixture.tsx')
  writeFileSync(
    fixture,
    "import { OTPInput } from 'input-otp'\nexport const Example = () => <OTPInput maxLength={6} />\n",
  )
  execFileSync(executable, ['input-otp-to-otp', fixture], {
    cwd: consumer,
    stdio: 'inherit',
  })
  const transformed = readFileSync(fixture, 'utf8')
  if (!transformed.includes("from '@rxova/react-otp-input'")) {
    fail('installed transform did not rewrite the package import')
  }
  if (!transformed.includes('OtpInput')) {
    fail('installed transform did not rewrite the component name')
  } else {
    console.log('  ✔ installed transform rewrites a TSX fixture')
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  failures += 1
} finally {
  rmSync(workdir, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\n✖ codemod pack smoke test failed with ${String(failures)} problem(s)`)
  process.exit(1)
}
console.log('\n✔ codemod pack smoke test passed')
