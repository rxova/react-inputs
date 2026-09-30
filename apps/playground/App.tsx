import { useState, type ComponentType } from 'react'

/**
 * The manual-QA aggregator: it renders each package's own demo (the same one
 * that package's E2E suite drives standalone) behind a tiny path router.
 * `vite preview` serves index.html for every path, so reading
 * `window.location.pathname` is enough to pick a page.
 *
 * Routes are discovered, not listed. Every component package ships a
 * `demo/Demos.tsx` with a default export and declares an `rxova` block in its
 * package.json; the two globs below join on the directory name. Adding an input
 * adds its page here with no edit — which is the point, because a playground
 * that silently omits a new component is worse than no playground: it looks
 * complete.
 *
 * The registry module in scripts/ is deliberately NOT imported: it reads
 * the filesystem, and this bundle runs in a browser. `import.meta.glob` is the
 * same discovery performed at build time.
 */

type Direction = 'ltr' | 'rtl'
type DemoComponent = ComponentType<{ dir?: Direction }>

interface Route {
  slug: string
  title: string
  label: string
  Demos: DemoComponent
}

const demoModules = import.meta.glob<{ default: DemoComponent }>(
  '../../packages/*/demo/Demos.tsx',
  { eager: true },
)

const manifests = import.meta.glob<{
  default: { rxova?: { slug?: string; title?: string; label?: string } }
}>('../../packages/*/package.json', { eager: true })

/** `../../packages/<dir>/…` → `<dir>`. */
const directoryOf = (path: string) => path.split('/')[3] ?? ''

const manifestsByDirectory = new Map(
  Object.entries(manifests).map(([path, module]) => [directoryOf(path), module.default]),
)

const routes: Route[] = Object.entries(demoModules)
  .flatMap(([path, module]) => {
    const rxova = manifestsByDirectory.get(directoryOf(path))?.rxova
    // A demo without a declaration is not addressable — there is no slug to
    // route it under. componentPackages() applies the same rule, and its suite
    // fails when a demo-carrying package forgets to declare itself.
    if (!rxova?.slug) return []

    return [
      {
        slug: rxova.slug,
        title: rxova.title ?? rxova.label ?? rxova.slug,
        label: rxova.label ?? rxova.slug,
        Demos: module.default,
      },
    ]
  })
  // Alphabetically by label, matching componentPackages() — the build-time
  // discovery this file mirrors. Display order is derived, not declared.
  .sort(
    (a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) ||
      a.slug.localeCompare(b.slug),
  )

function Landing() {
  return (
    <main>
      <h1>rxova inputs — playground</h1>
      <ul>
        {routes.map(({ slug, title }) => (
          <li key={slug}>
            <a href={`/${slug}`}>{title}</a>
          </li>
        ))}
      </ul>
    </main>
  )
}

/**
 * One page shape for every component. The RTL toggle used to be per-route and
 * absent from currency; every demo now accepts `dir`, so the control is uniform
 * and a new input gets it for free.
 */
function DemoRoute({ title, Demos }: Route) {
  const [rtl, setRtl] = useState(false)

  return (
    <>
      <header>
        <h1>{title}</h1>
        <label>
          <input
            type="checkbox"
            data-testid="rtl-toggle"
            checked={rtl}
            onChange={(e) => {
              setRtl(e.target.checked)
              document.documentElement.dir = e.target.checked ? 'rtl' : 'ltr'
            }}
          />
          Right-to-left
        </label>
      </header>
      <Demos dir={rtl ? 'rtl' : 'ltr'} />
    </>
  )
}

export function App() {
  const path = window.location.pathname
  const route = routes.find((candidate) => path === `/${candidate.slug}`)

  return route ? <DemoRoute {...route} /> : <Landing />
}
