import { defineRouteMiddleware } from "@astrojs/starlight/route-data";

import { withBase } from "@rxova/docs-kit";

/**
 * Applies `base` to the splash page's hero action links.
 *
 * Starlight renders `hero.actions[].link` straight into the button's `href`, and
 * those links live in frontmatter, so neither Astro nor the remark pipeline gets
 * a chance to prefix them (see src/plugins/remark-base-links.mjs, which handles
 * every link in page *content*). Without this the two "Get started" buttons are
 * the only 404s on the aggregated site.
 */
export const onRequest = defineRouteMiddleware((context) => {
  const actions = context.locals.starlightRoute.entry.data.hero?.actions;
  if (!actions) return;

  for (const action of actions) {
    action.link = withBase(action.link, import.meta.env.BASE_URL);
  }
});
