// The shadcn-style component registry: https://ui.shadcn.com/docs/registry
//
//   npx shadcn@latest add https://rxova.dev/packages/react-inputs/r/otp-field.json
//
// `shadcn add` is now the default install verb in a lot of React projects, and an
// agent working in one will reach for it before `npm install`. Being absent from
// that path is the difference between being installable and being chosen.
//
// ## What these items are, and are not
//
// They are NOT copies of the components. A registry that inlines a component's
// source creates a second, unversioned fork of it in every consumer — outside
// semver, outside the size budgets, outside the 95%-per-file coverage gate. The
// three things that make the published artifact trustworthy would silently not
// apply to the code people actually run.
//
// So each item distributes the WIRING: a field wrapper (label, description,
// error, ids) plus a stylesheet, with the component itself staying an npm
// dependency the item declares. That split matches what is actually worth owning
// — every project rewrites the wrapper, nobody wants to maintain a caret model.
//
// ## Styling-agnostic on purpose
//
// No Tailwind, no utility classes. The components theme entirely through CSS
// custom properties, so each item's stylesheet is a bridge from those to design
// tokens, written as `var(--token, fallback)`. It drops into a shadcn project and
// picks up its theme; it drops into a plain Vite app and still looks right. A
// suite whose whole claim is "no stylesheet to import" should not ship a registry
// that requires a CSS framework.

const SCHEMA = "https://ui.shadcn.com/schema/registry-item.json";
const REGISTRY_SCHEMA = "https://ui.shadcn.com/schema/registry.json";

/** Where `shadcn add` writes a file, relative to the consumer's project. */
const target = (name, ext) => `components/rxova/${name}.${ext}`;

/**
 * One registry item.
 *
 * `registry:component` for the tsx so the CLI applies its own path aliasing;
 * `registry:file` with an explicit target for the css, which the CLI otherwise
 * has no convention for.
 */
export function registryItem({ name, title, description, dependency, tsx, css }) {
  return {
    $schema: SCHEMA,
    name,
    type: "registry:component",
    title,
    description,
    // The component stays an npm dependency. This is the line that keeps the
    // copied code a wrapper rather than a fork.
    dependencies: [dependency],
    files: [
      { path: target(name, "tsx"), type: "registry:component", content: tsx },
      {
        path: target(name, "css"),
        type: "registry:file",
        target: target(name, "css"),
        content: css,
      },
    ],
  };
}

/** The index `shadcn` reads to list what this registry offers. */
export function registryIndex(items, origin) {
  return {
    $schema: REGISTRY_SCHEMA,
    name: "rxova",
    homepage: origin,
    items: items.map(({ name, type, title, description, dependencies }) => ({
      name,
      type,
      title,
      description,
      dependencies,
    })),
  };
}
