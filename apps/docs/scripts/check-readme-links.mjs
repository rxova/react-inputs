/**
 * Fails the docs build if any rxova.dev link written outside the docs site
 * points at a route the site does not emit.
 *
 * starlight-links-validator only inspects links between pages of this site. The
 * READMEs link to the same pages by absolute URL, from outside it — so when the
 * Docusaurus-era routes were restructured into components/<name>/*, every
 * "Documentation →" link in every package README silently became a 404 and
 * nothing caught it. package.json `homepage` had the same problem, and that one
 * is what npm renders as the package page's home link.
 *
 * Checked against the built dist rather than the content directory: redirects
 * are a legitimate destination (see the `redirects` map in astro.config.mjs) and
 * only exist as build output. Anchors are resolved too, since the guides were
 * folded into per-component About pages as headings — a link to the page that
 * misses the section is the same broken promise in a quieter form.
 *
 * Offline: reads files only.
 *
 * Usage: `node ./scripts/check-readme-links.mjs [repoRoot] [distDir]`. Both
 * arguments default to this repo's layout; they exist so the test suite can
 * point the checker at a fixture tree instead of the real one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const docsRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

export const DEFAULT_REPO_ROOT = resolve(docsRoot, '../..')
export const DEFAULT_DIST = join(docsRoot, 'dist')

/** Where the aggregator mounts this site; dist paths are relative to it. */
export const MOUNT = '/packages/react-inputs'
export const SITE = `https://rxova.dev${MOUNT}`

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.git',
  '.turbo',
  '.astro',
  '.claude',
  'coverage',
])

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      yield* walk(join(dir, entry.name))
      continue
    }
    // CHANGELOGs are a historical record — the URLs in them were correct when
    // that version shipped and rewriting them would be a lie.
    if (entry.name === 'CHANGELOG.md') continue
    // llms.txt alongside the markdown: it ships in every package tarball and
    // links to this site, so a route that moved breaks it exactly the way it
    // breaks a README — and it is read by agents, which are less likely than a
    // human to work around a 404.
    if (entry.name.endsWith('.md') || entry.name === 'package.json' || entry.name === 'llms.txt') {
      yield join(dir, entry.name)
    }
  }
}

/** Every rxova.dev docs URL under `repoRoot`, with the file it came from. */
export function collectLinks(repoRoot) {
  const found = []
  for (const file of walk(repoRoot)) {
    const text = readFileSync(file, 'utf8')
    for (const [url] of text.matchAll(
      /https:\/\/rxova\.dev\/packages\/react-inputs[^\s)"'`<>\]]*/g,
    )) {
      // Prose runs a link into the sentence's punctuation: `…/introduction/.`
      found.push({ url: url.replace(/[.,]$/, ''), file: relative(repoRoot, file) })
    }
  }
  return found
}

const readIfFile = (path) => {
  try {
    return statSync(path).isFile() ? readFileSync(path, 'utf8') : null
  } catch {
    return null
  }
}

/** The emitted HTML for a route, or null if the site has no such route. */
export function resolveRoute(dist, pathname) {
  const clean = pathname.replace(/^\/+|\/+$/g, '')

  // A URL carrying a file extension names a file, not a route: the raw-markdown
  // twins (`…/usage.md`) and llms.txt are served as themselves. Without this,
  // `…/usage.md` would be looked for at `…/usage.md/index.html` and reported
  // missing — so the checker would fail every link to the surfaces this site
  // publishes for agents.
  if (/\.[a-z0-9]+$/i.test(clean)) return readIfFile(join(dist, clean))

  // build.format: 'directory' — a route is <route>/index.html. The bare .html
  // fallback covers anything emitted flat.
  return readIfFile(join(dist, clean, 'index.html')) ?? readIfFile(join(dist, `${clean}.html`))
}

const isRedirectStub = (html) => /http-equiv="refresh"/i.test(html)

/**
 * Every link in `repoRoot` that `dist` does not answer.
 *
 * Returns `{ file, url, reason }` rather than formatted strings so the caller
 * decides how to present them — and so the tests can assert on the verdict
 * instead of on prose.
 */
export function checkReadmeLinks({ repoRoot = DEFAULT_REPO_ROOT, dist = DEFAULT_DIST } = {}) {
  const failures = []

  for (const { url, file } of collectLinks(repoRoot)) {
    const { pathname, hash } = new URL(url)
    // Boundary, not prefix: a sibling project mounted at /packages/react-inputs-suite
    // shares this prefix, and treating its URLs as routes here would report
    // failures for a site this build knows nothing about.
    if (pathname !== MOUNT && !pathname.startsWith(`${MOUNT}/`)) continue

    const route = pathname.slice(MOUNT.length) || '/'
    const html = resolveRoute(dist, route)

    if (html === null) {
      failures.push({ file, url, reason: `no page or redirect at ${route}` })
      continue
    }

    // A redirect stub has no content of its own, so its anchors live on the
    // destination. Following it here would test the same thing twice; the
    // destination is checked on its own whenever something links to it directly.
    if (!hash || isRedirectStub(html)) continue

    const id = hash.slice(1)
    if (!html.includes(`id="${id}"`)) {
      failures.push({ file, url, reason: `${route} exists but has no #${id}` })
    }
  }

  return failures
}

export function formatFailures(failures) {
  const details = failures.map(({ file, url, reason }) => `${file}\n  ${url}\n  → ${reason}`)
  return (
    `\n${failures.length} broken ${SITE} link(s):\n\n${details.join('\n\n')}\n\n` +
    'Either fix the link, or add a redirect in apps/docs/astro.config.mjs if the\n' +
    'route is one that already shipped in a published README.\n'
  )
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (invokedDirectly) {
  const [repoRoot = DEFAULT_REPO_ROOT, dist = DEFAULT_DIST] = process.argv.slice(2)
  const failures = checkReadmeLinks({ repoRoot, dist })

  if (failures.length > 0) {
    console.error(formatFailures(failures))
    process.exit(1)
  }

  console.log(`✓ every ${SITE} link in the repo resolves`)
}
