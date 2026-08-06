import { Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router'
import type { MetaFunction } from 'react-router'

export const meta: MetaFunction = () => [{ title: 'Rxova framework compatibility' }]

export default function App() {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
