/**
 * Fails if a published package's `llms.txt` is missing, malformed, or has drifted
 * from the props it documents.
 *
 * These files ship inside the tarball, so they are what a coding agent reads out
 * of `node_modules` after an install. That makes their failure mode unusually
 * quiet: a prop renamed in `types.ts` leaves the table describing an API that no
 * longer exists, every test still passes, and the reader most likely to be misled
 * is the one least able to notice. Nothing else in the repo looks at these files.
 *
 * So the check that earns its keep is the last one — every prop named in the
 * table must actually be a member of the component's props interface. The rest
 * are structural, and mostly catch a file copy-pasted from a sibling package.
 *
 * Snippet correctness is NOT checked here: `check-doc-snippets.ts` already
 * enumerates every package llms.txt and type-transpiles each fence, and the
 * rxova.org links are resolved against the built site by the docs build's
 * `check-readme-links.mjs`. One rule, one place.
 *
 * Offline: reads files only.
 *
 * Usage: `node --import tsx ./packages/utils/check-llms.ts [repoRoot]`.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

import { readManifest } from './manifest'

export const LLMS_FILE = 'llms.txt'

export interface Failure {
  readonly package: string
  readonly reason: string
}

/** Every package that publishes a tarball, as `{ dir, name, files }`. */
export function publishedPackages(repoRoot: string) {
  const packagesDir = join(repoRoot, 'packages')

  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      dir: entry.name,
      manifestPath: join(packagesDir, entry.name, 'package.json'),
    }))
    .filter(({ manifestPath }) => existsSync(manifestPath))
    .map(({ dir, manifestPath }) => ({ dir, manifest: readManifest(manifestPath) }))
    .filter(({ manifest }) => manifest.private !== true)
    .map(({ dir, manifest }) => {
      const rxova = manifest.rxova
      const slug =
        typeof rxova === 'object' && rxova !== null && 'slug' in rxova
          ? (rxova as { slug?: unknown }).slug
          : undefined
      return {
        dir,
        name: manifest.name,
        files: Array.isArray(manifest.files) ? (manifest.files as string[]) : [],
        slug: typeof slug === 'string' ? slug : undefined,
      }
    })
}

/**
 * The prop names in the first column of every markdown table under `## Props`.
 *
 * Deliberately tolerant about which table: a package may document its component
 * and its hook in separate tables, and both are worth checking. A row whose first
 * cell is not a single backticked identifier (a `| --- |` separator, a prose row)
 * is skipped rather than reported — the goal is to catch a renamed prop, not to
 * police table formatting.
 */
export function documentedProps(body: string): string[] {
  // Sliced line-by-line rather than with one regex. The obvious
  // /^## Props$([\s\S]*?)(?=^## |\s*$)/m captures NOTHING: `\s*$` in the
  // lookahead matches an empty string at the very next position, so the lazy
  // body stops immediately. The checker then passes on every file, which is
  // worse than not having it — a gate that cannot fail reads exactly like one
  // that never needed to.
  const lines = body.split('\n')
  const start = lines.findIndex((line) => line.trim() === '## Props')
  if (start === -1) return []

  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  const section = (end === -1 ? rest : rest.slice(0, end)).join('\n')

  return [...section.matchAll(/^\|\s*`([A-Za-z_$][\w$-]*)`\s*\|/gm)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
}

/**
 * Every property name declared by an exported interface in `src/types.ts`.
 *
 * A flat set across all interfaces, not per-interface: a package documents one
 * table for a surface that is often assembled from several (`OtpInputProps` plus
 * `OtpSlotProps`), and matching them up would encode a structure the files do not
 * promise. The question worth answering is "does this name still exist anywhere
 * in the public types", because that is what a rename breaks.
 */
export function declaredProps(typesPath: string): Set<string> {
  const names = new Set<string>()
  if (!existsSync(typesPath)) return names

  const source = ts.createSourceFile(
    typesPath,
    readFileSync(typesPath, 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
  )

  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node)) {
      for (const member of node.members) {
        if (!ts.isPropertySignature(member)) continue
        const { name } = member
        if (ts.isIdentifier(name) || ts.isStringLiteral(name)) names.add(name.text)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(source)
  return names
}

export function checkLlms(repoRoot: string = process.cwd()): Failure[] {
  const failures: Failure[] = []

  for (const pkg of publishedPackages(repoRoot)) {
    const add = (reason: string): void => void failures.push({ package: pkg.name, reason })
    const path = join(repoRoot, 'packages', pkg.dir, LLMS_FILE)

    if (!existsSync(path)) {
      add(`has no ${LLMS_FILE} — every published package ships one`)
      continue
    }
    if (!pkg.files.includes(LLMS_FILE)) {
      // Present but unshipped is the worst of both: maintained by hand, read by
      // nobody, and nothing else would ever say so.
      add(`${LLMS_FILE} exists but is not in the \`files\` array, so it is not published`)
    }

    const body = readFileSync(path, 'utf8')
    const lines = body.split('\n')

    // The H1 is the package name because these files are near-identical in
    // shape, and a copy-pasted sibling is the likeliest way one goes wrong.
    if (lines[0] !== `# ${pkg.name}`) {
      add(`${LLMS_FILE} must open with "# ${pkg.name}", found ${JSON.stringify(lines[0] ?? '')}`)
    }
    // llmstxt.org: a blockquote summary directly under the title.
    if (!lines.slice(1, 4).some((line) => line.startsWith('> '))) {
      add(`${LLMS_FILE} needs a "> " summary blockquote under the title`)
    }

    // "How do I run this" and "where do I read more". `## Use` is accepted
    // alongside `## Install` because @rxova/codemod is a CLI invoked with npx
    // rather than a dependency — demanding an Install section there would only
    // produce a heading that lies.
    if (!/^## (?:Install|Use)$/m.test(body)) {
      add(`${LLMS_FILE} is missing an "## Install" (or "## Use") section`)
    }
    if (!/^## Docs$/m.test(body)) {
      add(`${LLMS_FILE} is missing a "## Docs" section`)
    }
    if (pkg.slug !== undefined) {
      const registryPath = `/r/${pkg.slug}-field.json`
      if (!body.includes(registryPath)) {
        add(`${LLMS_FILE} is missing its copyable registry URL (${registryPath})`)
      }
      const recipesPath = `/components/${pkg.slug}/about/#ui-library-recipes`
      if (!body.includes(recipesPath)) {
        add(`${LLMS_FILE} is missing its UI-library recipes URL (${recipesPath})`)
      }
    }

    // A package with a props table must keep it honest. Packages without one
    // (the meta-package, the codemod) are exempt rather than forced to invent
    // one — a table of props they do not own would be the drift, not the fix.
    const documented = documentedProps(body)
    if (documented.length > 0) {
      const declared = declaredProps(join(repoRoot, 'packages', pkg.dir, 'src', 'types.ts'))
      if (declared.size === 0) {
        add(`${LLMS_FILE} documents props but src/types.ts declares none to check against`)
      } else {
        for (const prop of documented) {
          if (!declared.has(prop)) {
            add(`${LLMS_FILE} documents \`${prop}\`, which no longer exists in src/types.ts`)
          }
        }
      }
    }
  }

  return failures
}

export function formatFailures(failures: Failure[]): string {
  const details = failures.map(({ package: name, reason }) => `  ✗ ${name} ${reason}`)
  return `${String(failures.length)} llms.txt problem(s):\n${details.join('\n')}`
}

const isEntrypoint =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntrypoint) {
  const [repoRoot = process.cwd()] = process.argv.slice(2)
  const failures = checkLlms(resolve(repoRoot))

  if (failures.length > 0) {
    console.error(formatFailures(failures))
    process.exit(1)
  }

  console.log('✔ Every published package ships a well-formed llms.txt')
}
