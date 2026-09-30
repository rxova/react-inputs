/**
 * The docs prop tables are extracted, not authored — react-docgen-typescript
 * reads each component's source and Storybook renders what it finds. When the
 * extractor silently matches no files the pages still build and still render:
 * the title and the stories are there, so nothing looks broken, but every
 * description, default and unset prop is gone. That is a regression no build
 * failure and no snapshot of the story canvas can catch.
 *
 * So this asserts on the extractor's actual output. The plugin under test is
 * built the way Storybook builds it — by calling the framework preset with this
 * app's `main.ts` — rather than re-declaring the options here, so what is
 * covered is the shipped configuration and not a copy of it.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { viteFinal } from "@storybook/react-vite/preset";
// Relative, like apps/docs/astro.config.mjs: the registry is dependency-free
// and read across the workspace by path rather than through a package export.
import { componentPackages, REPO_ROOT } from "../../../scripts/component-packages.mjs";
import mainConfig from "../.storybook/main";

/** One component, as react-docgen-typescript describes it. */
interface DocgenInfo {
  description: string;
  displayName: string;
  props: Record<
    string,
    {
      description: string;
      defaultValue: { value: string } | null;
      required: boolean;
    }
  >;
}

/** The subset of a Rollup plugin context the extractor touches. */
interface StubContext {
  warn: (message: unknown) => void;
  error: (message: unknown) => never;
  addWatchFile: (id: string) => void;
}

interface DocgenPlugin {
  name: string;
  configResolved: (this: StubContext, config: { root: string; command: string }) => Promise<void>;
  transform: (this: StubContext, code: string, id: string) => Promise<{ code: string } | undefined>;
  buildEnd: (this: StubContext) => void;
}

const storybookRoot = fileURLToPath(new URL("..", import.meta.url));

/**
 * Every authored component source in a package. Tests and demos are excluded
 * for the same reason `tsconfig.docgen.json` excludes them: they are not
 * components the docs describe, and extracting them would put their props in
 * the tables.
 */
const componentSources = (packageDir: string): string[] => {
  const src = join(REPO_ROOT, "packages", packageDir, "src");

  return readdirSync(src, { recursive: true, withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".tsx") &&
        !entry.name.includes(".test.") &&
        !entry.parentPath.includes("__tests__"),
    )
    .map((entry) => join(entry.parentPath, entry.name));
};

/**
 * The docgen blocks the plugin appended to a transformed module.
 *
 * `generateDocgenCodeBlock` emits one `X.__docgenInfo = {…};` statement per
 * component, the object a single line of `JSON.stringify` output — so a line
 * scan is exact here, no brace matching needed.
 */
const extractDocgen = (code: string): DocgenInfo[] =>
  code
    .split("\n")
    .flatMap((line) => {
      const match = /__docgenInfo = (\{.*\});?\s*$/.exec(line);
      return match?.[1] ? [JSON.parse(match[1]) as DocgenInfo] : [];
    })
    // Storybook only renders docgen for things it also renders as components;
    // a `const` the extractor happened to describe has no props and no bearing.
    .filter((info) => Object.keys(info.props).length > 0);

/**
 * Discovered, not listed. A component package added later is covered the day it
 * declares itself — the failure mode this guards against is silent, so opting
 * in by hand is the one thing that must not be required.
 */
const packages = componentPackages();

/** Extracted docgen per package directory, filled once in `beforeAll`. */
const extracted = new Map<string, DocgenInfo[]>();

/**
 * A plugin context stub. The extractor reaches for `warn` on the paths where it
 * gives up on a file, so routing that to a throw is what keeps a silently empty
 * extraction from reading as a pass.
 */
const context: StubContext = {
  warn: (message) => {
    throw new Error(`The docgen extractor warned: ${String(message)}`);
  },
  error: (message) => {
    throw new Error(String(message));
  },
  addWatchFile: () => {
    // Nothing watches here: the suite transforms once and exits.
  },
};

let plugin: DocgenPlugin | undefined;

beforeAll(async () => {
  // `viteFinal` reads the `typescript` preset — exactly the block of main.ts
  // under test — and returns the config with the docgen plugins added.
  const resolved = await (
    viteFinal as unknown as (
      config: Record<string, unknown>,
      options: { presets: { apply: (key: string, fallback?: unknown) => Promise<unknown> } },
    ) => Promise<{ plugins: DocgenPlugin[] }>
  )(
    {},
    {
      presets: {
        apply: (key, fallback) =>
          Promise.resolve(key === "typescript" ? mainConfig.typescript : fallback),
      },
    },
  );

  const found = resolved.plugins.find((entry) => entry.name === "vite:react-docgen-typescript");
  if (!found) {
    throw new Error(
      "The react-docgen-typescript plugin is absent. `typescript.reactDocgen` in .storybook/main.ts is what adds it.",
    );
  }
  plugin = found;

  // `serve`, because that is what `storybook dev` resolves to and the plugin
  // branches on it. `root` is this app, as Vite would resolve it.
  await plugin.configResolved.call(context, { root: storybookRoot, command: "serve" });

  for (const pkg of packages) {
    const infos: DocgenInfo[] = [];
    // Sequentially: the extractor keeps one TypeScript program behind the
    // transform, and asking it for several files at once makes it rebuild under
    // itself and answer with partial results.
    for (const file of componentSources(pkg.dir)) {
      const result = await plugin.transform.call(context, readFileSync(file, "utf8"), file);
      if (result) infos.push(...extractDocgen(result.code));
    }
    extracted.set(pkg.dir, infos);
  }
}, 120_000);

afterAll(() => {
  plugin?.buildEnd.call(context);
});

describe("docs prop tables", () => {
  it("finds the component packages to check", () => {
    expect(packages.length).toBeGreaterThan(0);
  });

  describe.each(packages)("$title", ({ dir }) => {
    const docs = () => extracted.get(dir) ?? [];

    it("extracts docgen for at least one component", () => {
      expect(docs().map((info) => info.displayName)).not.toHaveLength(0);
    });

    it("carries the component descriptions the docs page renders above the stories", () => {
      const described = docs().filter((info) => info.description.trim() !== "");
      expect(described.map((info) => info.displayName)).not.toHaveLength(0);
    });

    it("carries per-prop descriptions, not just names", () => {
      // The regression looked like this: prop rows still appeared, because
      // `args` imply them, but every Description cell held only a type.
      const describedProps = docs().flatMap((info) =>
        Object.entries(info.props)
          .filter(([, prop]) => prop.description.trim() !== "")
          .map(([name]) => `${info.displayName}.${name}`),
      );
      expect(describedProps.length).toBeGreaterThan(3);
    });

    it("keeps the inherited DOM props out of the tables", () => {
      // CurrencyInput extends InputHTMLAttributes. Without the propFilter its
      // own props are a rounding error in the table, so an extraction that
      // "works" can still be useless.
      // Sentinels no input declares itself, unlike `dir`, which two of them do.
      const inherited = ["onAnimationStart", "dangerouslySetInnerHTML", "suppressHydrationWarning"];
      const domProps = docs().flatMap((info) =>
        Object.keys(info.props).filter((name) => inherited.includes(name)),
      );
      expect(domProps).toEqual([]);
    });
  });

  it("resolves prop defaults for the Default column", () => {
    // Asserted once across the suite rather than per package: a package whose
    // props genuinely have no defaults is legitimate, an extractor that never
    // resolves one is not.
    const withDefaults = [...extracted.values()]
      .flat()
      .flatMap((info) => Object.values(info.props))
      .filter((prop) => prop.defaultValue !== null);

    expect(withDefaults.length).toBeGreaterThan(0);
  });
});
