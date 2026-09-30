// https://rxova.dev/packages/react-inputs/llms.txt — the agent-facing index.
//
// The document is @rxova/docs-kit's `llmsIndex`; its sections, summary and
// install preamble are this site's (src/lib/site-markdown.mjs). This is the
// adapter: read the pages, read the component list the config injected, serve
// the text.

import type { APIRoute } from 'astro'

import { llmsIndex } from '@rxova/docs-kit'

import { docsPages } from '../lib/docs-md.mjs'
import { installPreamble, llmsOptions } from '../lib/site-markdown.mjs'

export const prerender = true

export const GET: APIRoute = async () => {
  const pages = await docsPages({
    origin: import.meta.env.SITE,
    base: import.meta.env.BASE_URL,
  })

  // The mount, not the bare origin: under the aggregator this site lives at
  // /packages/react-inputs/, and a registry URL that dropped that prefix would
  // 404 in the one place it is meant to be pasted.
  const mount = `${import.meta.env.SITE}${import.meta.env.BASE_URL}`.replace(/\/$/, '')

  const text = llmsIndex(pages, {
    ...llmsOptions(__RXOVA_COMPONENTS__),
    mount,
    preamble: installPreamble(__RXOVA_COMPONENTS__, mount),
  })

  return new Response(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
