// https://rxova.dev/packages/react-inputs/llms-full.txt — every page, inlined.
//
// For the case where one fetch should be the whole documentation set rather than
// an index to follow. `rxova-docs-kit check-md-routes` holds it to a size budget, so
// if the suite grows past what fits in a context window the build says so rather
// than an agent silently truncating it.

import type { APIRoute } from 'astro'

import { llmsFull } from '@rxova/docs-kit'

import { docsPages } from '../lib/docs-md.mjs'
import { llmsOptions } from '../lib/site-markdown.mjs'

export const prerender = true

export const GET: APIRoute = async () => {
  const pages = await docsPages({
    origin: import.meta.env.SITE,
    base: import.meta.env.BASE_URL,
  })

  return new Response(llmsFull(pages, llmsOptions(__RXOVA_COMPONENTS__)), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
