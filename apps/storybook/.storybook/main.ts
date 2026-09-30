import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import remarkGfm from "remark-gfm";

// Paths handed to the docgen extractor, resolved against this file. They have
// to be absolute: the plugin builds its include filter with vite's
// `createFilter` and passes no `resolve`, so a relative glob is anchored to
// `process.cwd()` — wherever `storybook` was invoked from, not this directory.
const docgenPath = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

const config: StorybookConfig = {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(ts|tsx)"],
  addons: [
    {
      name: "@storybook/addon-docs",
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            // MDX ships without GitHub-flavored markdown: the Introduction's
            // package table renders as literal pipes without this.
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  // The suite logo, served for the manager theme's brandImage.
  staticDirs: ["../../../assets"],
  typescript: {
    // The slower, TS-compiler-backed extractor. The default (react-docgen)
    // reads only what Babel can see, which loses the imported `*Props`
    // interfaces these components are typed with; this one resolves them, so
    // the docs prop tables carry every prop with its JSDoc, type and default.
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      // The components are not in this app — vite.config.ts aliases every
      // `@rxova/<name>` to `packages/<name>/src`. The extractor's default
      // include is `**/*.tsx` relative to the invocation directory, which
      // matches nothing outside apps/storybook, so every prop table fell back
      // to what `args` alone imply: no descriptions, no defaults, no props the
      // stories do not set. Point it at the package sources instead.
      include: [docgenPath("../../../packages/*/src/**/*.tsx")],
      // Mirrors the plugin's own default, which naming `include` would drop:
      // the stories are not components and must not be extracted.
      exclude: [docgenPath("../stories/**/*.tsx")],
      // ...and the extractor's TS program has to contain those same files, or
      // it compiles an empty project and every lookup misses. The app's own
      // tsconfig.json lists only .storybook and stories, so this points at a
      // sibling config that names the package sources. See tsconfig.docgen.json.
      tsconfigPath: docgenPath("../tsconfig.docgen.json"),
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      // CurrencyInput extends InputHTMLAttributes; without this filter its
      // table would drown the library's own props in hundreds of DOM ones.
      propFilter: (prop) => (prop.parent ? !prop.parent.fileName.includes("node_modules") : true),
    },
  },
};

export default config;
