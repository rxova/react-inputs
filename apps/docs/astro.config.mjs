import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import react from '@astrojs/react'
import { createStarlightTypeDocPlugin } from 'starlight-typedoc'
import starlightLinksValidator from 'starlight-links-validator'
import { sharedStarlightConfig } from '@rxova/brand'
import remarkLiveCode from './src/plugins/remark-live-code.mjs'
import remarkBaseLinks from './src/plugins/remark-base-links.mjs'
import { withBase } from './src/lib/base-url.mjs'
import { componentPackages } from '../../packages/utils/component-packages.mjs'

/**
 * Defaults keep the standalone build working; the rxova.org aggregator sets
 * DOCS_URL / DOCS_BASE_URL to mount these docs under /packages/react-inputs/.
 */
const site = process.env.DOCS_URL ?? 'https://rxova.org'
const base = process.env.DOCS_BASE_URL ?? '/'

/**
 * The components, discovered from the packages that declare themselves (see
 * packages/utils/component-packages.mjs). Drives the TypeDoc instances, the
 * sidebar and the redirects below — a new input needs no edit here.
 *
 * `slug` is the content directory and the URL segment; `label` is the sidebar
 * entry, which is not always the slug capitalised (OTP).
 */
const COMPONENTS = componentPackages()

/**
 * One TypeDoc instance per component, matching the Docusaurus setup. A single
 * instance with every package as an entry point would flip TypeDoc into
 * multi-module mode and rewrite every API URL.
 */
const typeDocDefaults = {
  typeDoc: {
    // Emit the entry page as index.md so each component's reference lives at
    // /components/<name>/api — which is what the prose already links to.
    // The default (README.md) would route to /api/readme and break 8 links.
    entryFileName: 'index',
    useCodeBlocks: true,
    disableSources: true,
    parametersFormat: 'table',
    enumMembersFormat: 'table',
  },
}

/**
 * One plugin instance per component, each with its OWN sidebar group.
 *
 * The shared `typeDocSidebarGroup` export is a single group object — with every
 * component registered against it, only one component's API ends up in the
 * sidebar. createStarlightTypeDocPlugin() hands back an independent
 * plugin/group pair, so each component's reference can be nested under that
 * component instead of collected into one top-level pile.
 */
const component = (name, pkg) => {
  // The generated pages land inside the component's own directory, so the
  // component's `autogenerate` entry already lists them — the pair's sidebar
  // group is deliberately unused.
  const [plugin] = createStarlightTypeDocPlugin()
  return plugin({
    ...typeDocDefaults,
    entryPoints: [`../../packages/${pkg}/src/index.ts`],
    tsconfig: `../../packages/${pkg}/tsconfig.json`,
    output: `components/${name}/api`,
    sidebar: { label: 'API', collapsed: true },
  })
}

/**
 * Regenerating every component's API reference costs more than `astro dev`
 * allows for startup.
 *
 * TypeDoc runs once per component, each taking a few seconds. At three
 * components that was tolerable; at nine it crosses the 30-second budget the
 * dev server gives startup, and `astro dev` exits with "Dev server failed to
 * start within 30s" — so the site became undevelopable the moment the suite
 * grew, with nothing pointing at the cause.
 *
 * The generated pages live in the content directory and survive between runs,
 * so dev reuses the last build's output instead of rebuilding it. A component
 * whose pages are missing is still generated, which keeps a fresh clone
 * working and means the skip can never leave the sidebar pointing at nothing.
 * `DOCS_API=1 pnpm dev` forces a full regeneration when a signature changed.
 */
const apiIsCurrent = (slug) =>
  existsSync(fileURLToPath(new URL(`./src/content/docs/components/${slug}/api`, import.meta.url)))

const regenerateApi = process.env.DOCS_API === '1' || process.env.npm_lifecycle_event === 'build'

const typeDocPlugins = COMPONENTS.filter(({ slug }) => regenerateApi || !apiIsCurrent(slug)).map(
  ({ slug, dir }) => component(slug, dir),
)

/**
 * A component's landing page. Starlight only emits routes for files that exist,
 * and a component directory holds no page of its own, so `/components/otp/`
 * — the shape people type and link — 404s while `/components/otp/introduction/`
 * works. Every redirect target goes through here.
 *
 * withBase is required: Astro writes the redirect destination verbatim (see
 * core/routing/3xx.js), so under the aggregator an unprefixed `/components/...`
 * would point one directory above where the docs are mounted. The route KEYS
 * must stay unprefixed — build output paths are relative to dist/, which is
 * what gets mounted at base.
 */
const introduction = (dir) => withBase(`/components/${dir}/introduction/`, base)
const migrating = (dir) => withBase(`/components/${dir}/migrating/`, base)

/**
 * The Docusaurus-era routes, which the restructure to per-component pages
 * removed (see scripts/restructure-components.mjs). These are not dead history:
 * they are still in the READMEs of every version already published to npm, and
 * those cannot be edited. Without redirects, "Documentation →" from a package
 * page is a 404 for anyone not on the latest release.
 */
const legacyRedirects = {
  // The cross-cutting guides were split into each component's About page,
  // so no single component is the honest successor. Overview links out to all
  // of them; an arbitrary component's About would be worse than a shelf.
  '/guides/accessibility': withBase('/overview/', base),
  '/guides/styling': withBase('/overview/', base),
  '/guides/form-libraries': withBase('/overview/', base),
  // Per-source migration pages, now sections of the component's Migrating page.
  '/migrating/from-input-otp': migrating('otp'),
  '/migrating/from-react-otp-input': migrating('otp'),
  '/migrating/from-react-rating': migrating('rating'),
  '/migrating/from-react-stars': migrating('rating'),
  '/migrating/from-radio-buttons': migrating('rating'),
  '/migrating/from-react-currency-input-field': migrating('currency'),
}

/**
 * Advertise the agent index from every page.
 *
 * `rel="alternate"` is the standard way to say "the same content, another
 * format", which is what llms.txt is — so a crawler that already parses link
 * relations finds it without being told the well-known path.
 *
 * This APPENDS rather than setting `head`, which is the whole reason it is a
 * function. sharedStarlightConfig already puts the Open Graph image and the
 * Twitter card in `head`; passing a `head` key alongside the spread would
 * silently replace both, and the symptom — link previews losing their image —
 * would show up nowhere in this repo.
 */
const withLlmsLink = (config) => ({
  ...config,
  head: [
    ...(config.head ?? []),
    {
      tag: 'link',
      attrs: {
        rel: 'alternate',
        type: 'text/plain',
        title: 'llms.txt',
        href: withBase('/llms.txt', base),
      },
    },
  ],
})

export default defineConfig({
  site,
  base,

  vite: {
    define: {
      // The component list, for the agent-facing endpoints in src/pages.
      //
      // They cannot call componentPackages() themselves: it resolves the repo
      // root from its own import.meta.url, and those modules are bundled into a
      // prerender chunk under dist/, where that points at a directory which does
      // not exist. This config is the last point in the build that runs in plain
      // node, so it is where the list has to be read — keeping one source of
      // truth rather than a second hardcoded list beside it.
      __RXOVA_COMPONENTS__: JSON.stringify(COMPONENTS),
    },
  },

  // Static redirects: Astro emits one meta-refresh index.html per entry, which
  // the aggregator publishes verbatim like any other file — the ingest contract
  // in .github/workflows/docs.yml is untouched.
  redirects: {
    ...Object.fromEntries(
      COMPONENTS.flatMap(({ slug }) => [
        [`/components/${slug}`, introduction(slug)],
        // The pre-restructure landing route, e.g. /otp.
        [`/${slug}`, introduction(slug)],
      ]),
    ),
    ...legacyRedirects,
  },

  markdown: {
    // Turns ```tsx live fences into the react-live island. Docusaurus had
    // theme-live-codeblock; Starlight has no equivalent, and for a component
    // library the editable examples are the product.
    // remarkBaseLinks makes the site's root-relative links honour `base`, which
    // Docusaurus did for free and Astro does not — see the plugin's header.
    remarkPlugins: [remarkLiveCode, [remarkBaseLinks, { base }]],
  },

  integrations: [
    react(),
    starlight({
      ...withLlmsLink(
        sharedStarlightConfig({
          project: 'react-inputs',
          // These docs ship as a page component: rxova.org composes each rendered
          // body into its own header and footer, so this build must not draw the
          // umbrella footer itself. It was doing that by overriding Starlight's
          // `Footer` with a local wrapper around the default, and reconciling the
          // two sticky headers in a `page-component.css` of its own — both copies
          // of what @rxova/brand ships behind this flag since 0.9.0. One flag now
          // says what the build is, and the theme owns how that looks.
          pageComponent: true,
          customCss: [
            './src/styles/live.css',
            './src/styles/sidebar.css',
            './src/styles/logos.css',
            './src/styles/content.css',
            // Last, so the landing's container widening wins over anything above
            // it that also reaches for .sl-container.
            './src/styles/home.css',
          ],
          // Components sit LAST and are the destination, not a preamble:
          // getting-started is a one-time read, the component list is what you
          // come back to. Each component is one clickable entry whose five
          // sections are identical, so the shape is learned once.
          sidebar: [
            { label: 'Overview', link: '/overview' },
            {
              label: 'Getting started',
              items: [{ autogenerate: { directory: 'getting-started' } }],
            },
            // The components sit at the top level rather than inside a
            // "Components" group: wrapping them added an accordion you had to open
            // before you could see the thing the site is about. The "Components"
            // heading above them is a static section label drawn in CSS
            // (src/styles/sidebar.css) — Starlight's sidebar has no non-collapsible
            // group type, so it cannot be expressed here.
            ...COMPONENTS.map(({ slug: name, label }) => ({
              label,
              // Closed by default: each component carries five sections, which is
              // a long sidebar if they all start open. Starlight keeps the group
              // containing the current page expanded regardless.
              collapsed: true,
              items: [
                // Listed explicitly rather than autogenerated: autogenerate would
                // label the generated reference from its directory name ("api",
                // lowercase) and splice TypeDoc's own nesting straight into the
                // component's section.
                `components/${name}/introduction`,
                `components/${name}/usage`,
                `components/${name}/about`,
                `components/${name}/migrating`,
                {
                  label: 'API',
                  collapsed: true,
                  items: [{ autogenerate: { directory: `components/${name}/api` } }],
                },
              ],
            })),
          ],
        }),
      ),
      // Applies `base` to the hero action links, which live in frontmatter and
      // so never reach the remark pipeline. See the middleware for why.
      routeMiddleware: './src/route-middleware.mjs',
      plugins: [...typeDocPlugins, starlightLinksValidator({ errorOnRelativeLinks: false })],
    }),
  ],
})
