// One registry item per route: /r/otp-field.json and friends.
//
//   npx shadcn@latest add https://rxova.org/packages/react-inputs/r/otp-field.json
//
// See src/lib/registry.mjs for what these items deliberately are and are not.

import type { APIRoute, GetStaticPaths } from 'astro'

import { registryItems } from '../../lib/registry-items.mjs'

export const prerender = true

const items = registryItems(__RXOVA_COMPONENTS__)

export const getStaticPaths: GetStaticPaths = () =>
  items.map((item: { name: string; [key: string]: unknown }) => ({
    params: { name: item.name },
    props: { item },
  }))

export const GET: APIRoute = ({ props }) =>
  new Response(JSON.stringify(props.item, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
