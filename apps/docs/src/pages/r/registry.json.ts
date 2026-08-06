// The registry index: /r/registry.json — what this registry offers, without the
// file contents. See src/lib/registry.mjs for the design.

import type { APIRoute } from 'astro'

import { registryItems } from '../../lib/registry-items.mjs'
import { registryIndex } from '../../lib/registry.mjs'

export const prerender = true

const items = registryItems(__RXOVA_COMPONENTS__)

export const GET: APIRoute = () =>
  new Response(JSON.stringify(registryIndex(items, import.meta.env.SITE), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
